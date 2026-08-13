import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const publishSchema = z.object({
  token: tokenSchema,
  scene: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  label: z.string().trim().max(80).optional(),
});

const readSchema = z.object({
  token: tokenSchema,
  sinceRevision: z.number().int().nonnegative().optional(),
});

const uploadSchema = z.object({
  token: tokenSchema,
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(3).max(120),
});

export type ProjectorStatus =
  | "unknown"
  | "waiting"
  | "live"
  | "stale"
  | "paused"
  | "disabled"
  | "unchanged";

export interface ProjectorSnapshot {
  status: ProjectorStatus;
  revision: number;
  scene: Record<string, unknown> | null;
  updatedAt: string | null;
  label: string | null;
}

/** Create a fresh, unguessable remote-projector channel. */
export const createProjectorChannel = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = `pj_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")}`.slice(
    0,
    32,
  );

  const { error } = await supabaseAdmin
    .from("projector_channels")
    .insert({ token, enabled: true, paused: false });
  if (error) throw new Error(error.message);
  return { token };
});

/** Publish the current scene snapshot to a channel (creates it when missing). */
export const publishProjectorScene = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => publishSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("projector_channels")
      .select("id, revision")
      .eq("token", data.token)
      .maybeSingle();

    const payload = {
      token: data.token,
      scene: data.scene,
      enabled: data.enabled ?? true,
      paused: data.paused ?? false,
      revision: (existing?.revision ?? 0) + 1,
      updated_at: new Date().toISOString(),
      ...(data.label ? { label: data.label } : {}),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("projector_channels")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("projector_channels").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { revision: payload.revision, updatedAt: payload.updated_at };
  });

/** Remote projector read: returns the latest snapshot plus a display status. */
export const getProjectorScene = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => readSchema.parse(data))
  .handler(async ({ data }): Promise<ProjectorSnapshot> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("projector_channels")
      .select("label, enabled, paused, scene, revision, updated_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) {
      return { status: "unknown", revision: 0, scene: null, updatedAt: null, label: null };
    }

    const revision = Number(row.revision ?? 0);
    const base = { revision, updatedAt: row.updated_at, label: row.label } as const;

    const status: ProjectorStatus = !row.enabled
      ? "disabled"
      : row.paused
        ? "paused"
        : !row.scene
          ? "waiting"
          : Date.now() - new Date(row.updated_at).getTime() > 30_000
            ? "stale"
            : "live";

    if (data.sinceRevision !== undefined && data.sinceRevision === revision) {
      return { ...base, status: status === "live" ? "unchanged" : status, scene: null };
    }

    const scene = (row.scene as Record<string, unknown> | null) ?? null;
    if (scene) await signSceneAssets(scene, supabaseAdmin);
    return { ...base, status, scene };
  });

/** Signed, short-lived upload target so large media never crosses the RPC boundary. */
export const createMediaUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
    const path = `${data.token}/${Date.now().toString(36)}_${safeName}`;

    const { data: signed, error } = await supabaseAdmin.storage
      .from("projector-media")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");

    return { path, signedUrl: signed.signedUrl, token: signed.token };
  });

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Replace `storage:<path>` references in a published scene with signed URLs. */
async function signSceneAssets(scene: Record<string, unknown>, admin: AdminClient) {
  const assets = scene["assets"];
  const paths: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.startsWith("storage:")) paths.push(value.slice(8));
  };
  if (Array.isArray(assets)) {
    for (const asset of assets) collect((asset as { url?: unknown } | null)?.url);
  }
  const background = scene["background"] as { url?: unknown } | null | undefined;
  collect(background?.url);
  if (paths.length === 0) return;

  const { data: signed } = await admin.storage
    .from("projector-media")
    .createSignedUrls(paths, 60 * 60 * 6);
  const map = new Map<string, string>();
  for (const entry of signed ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }

  const resolve = (value: unknown) =>
    typeof value === "string" && value.startsWith("storage:")
      ? (map.get(value.slice(8)) ?? null)
      : value;

  if (Array.isArray(assets)) {
    for (const asset of assets) {
      const record = asset as { url?: unknown };
      if (record) record.url = resolve(record.url);
    }
  }
  if (background) background.url = resolve(background.url);
}
