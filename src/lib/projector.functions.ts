import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type SceneJson = { [key: string]: Json };

const publishSchema = z.object({
  token: tokenSchema,
  scene: z.record(z.string(), z.any()).transform((v) => v as SceneJson),
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  label: z.string().trim().max(80).optional(),
});

const readSchema = z.object({
  token: tokenSchema,
  sinceRevision: z.number().int().nonnegative().optional(),
});

/** Only projectable media may be uploaded — the bucket is not general storage. */
const ALLOWED_MEDIA = /^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

const uploadSchema = z.object({
  token: tokenSchema,
  fileName: z.string().trim().min(1).max(200),
  contentType: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .transform((value) => value.split(";")[0]!.trim().toLowerCase())
    .refine((value) => ALLOWED_MEDIA.test(value), "Unsupported media type"),
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
  scene: SceneJson | null;
  updatedAt: string | null;
  label: string | null;
}

/**
 * Ensure the permanent kiosk channel row exists. Idempotent: safe to call on
 * every studio load so `/liveoutput` never needs a generated code.
 */
export const ensureProjectorChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: tokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("projector_channels")
      .select("id")
      .eq("token", data.token)
      .maybeSingle();
    if (existing) return { token: data.token, created: false };

    const { error } = await supabaseAdmin
      .from("projector_channels")
      .insert({ token: data.token, enabled: true, paused: false });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { token: data.token, created: true };
  });

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

/** Publish the current scene snapshot to an existing channel. */
export const publishProjectorScene = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => publishSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("projector_channels")
      .select("id, revision")
      .eq("token", data.token)
      .maybeSingle();

    // Only codes minted by createProjectorChannel may be published to, so a
    // caller cannot conjure channels (and their storage prefix) at will.
    if (!existing) throw new Error("Unknown projector code");

    const payload = {
      scene: data.scene as never,
      enabled: data.enabled ?? true,
      paused: data.paused ?? false,
      revision: existing.revision + 1,
      updated_at: new Date().toISOString(),
      ...(data.label ? { label: data.label } : {}),
    };

    const { error } = await supabaseAdmin
      .from("projector_channels")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

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

    const scene = (row.scene as SceneJson | null) ?? null;
    if (scene) await signSceneAssets(scene, supabaseAdmin);
    return { ...base, status, scene };
  });

/** Signed, short-lived upload target so large media never crosses the RPC boundary. */
export const createMediaUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Uploads are only for real, existing channels — never for an arbitrary
    // token shape, so the bucket cannot be used as open file hosting.
    const { data: channel } = await supabaseAdmin
      .from("projector_channels")
      .select("id")
      .eq("token", data.token)
      .maybeSingle();
    if (!channel) throw new Error("Unknown projector code");

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
async function signSceneAssets(scene: SceneJson, admin: AdminClient) {
  const assets = scene["assets"];
  const paths: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.startsWith("storage:")) paths.push(value.slice(8));
  };
  if (Array.isArray(assets)) {
    for (const asset of assets) collect((asset as { url?: unknown } | null)?.url);
  }
  const background = scene["background"] as { url?: Json } | null | undefined;
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
      const record = asset as { url?: Json };
      if (record) record.url = resolve(record.url) as Json;
    }
  }
  if (background) background.url = resolve(background.url) as Json;
}
