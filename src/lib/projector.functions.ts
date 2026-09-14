import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type SceneJson = { [key: string]: Json };

const publishSchema = z.object({ token: tokenSchema, scene: z.record(z.string(), z.any()).transform((v) => v as SceneJson), enabled: z.boolean().optional(), paused: z.boolean().optional(), label: z.string().trim().max(80).optional() });
const readSchema = z.object({ token: tokenSchema, sinceRevision: z.number().int().nonnegative().optional() });
const ALLOWED_MEDIA = /^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;
const MEDIA_BY_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
function canonicalMediaType(fileName: string, contentType: string) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED_MEDIA.test(normalized)) return normalized;
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  return MEDIA_BY_EXT[extension] ?? normalized;
}
const uploadSchema = z.object({ token: tokenSchema, fileName: z.string().trim().min(1).max(200), contentType: z.string().trim().min(3).max(120) }).transform((data) => ({ ...data, contentType: canonicalMediaType(data.fileName, data.contentType) })).refine((data) => ALLOWED_MEDIA.test(data.contentType), { path: ["contentType"], message: "Unsupported media type" });

export type ProjectorStatus = "unknown" | "waiting" | "live" | "stale" | "paused" | "disabled" | "unchanged";
export interface ProjectorSnapshot { status: ProjectorStatus; revision: number; scene: SceneJson | null; updatedAt: string | null; label: string | null; }

export const ensureProjectorChannel = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ token: tokenSchema }).parse(data)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.from("projector_channels").select("id").eq("token", data.token).maybeSingle();
  if (existing) return { token: data.token, created: false };
  const { error } = await supabaseAdmin.from("projector_channels").insert({ token: data.token, enabled: true, paused: false });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  return { token: data.token, created: true };
});

export const createProjectorChannel = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = new Uint8Array(18); crypto.getRandomValues(bytes);
  const token = `pj_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")}`.slice(0, 32);
  const { error } = await supabaseAdmin.from("projector_channels").insert({ token, enabled: true, paused: false });
  if (error) throw new Error(error.message);
  return { token };
});

export const publishProjectorScene = createServerFn({ method: "POST" }).inputValidator((data: unknown) => publishSchema.parse(data)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.from("projector_channels").select("id, revision").eq("token", data.token).maybeSingle();
  if (!existing) throw new Error("Unknown projector code");
  const payload = { scene: data.scene as never, enabled: data.enabled ?? true, paused: data.paused ?? false, revision: existing.revision + 1, updated_at: new Date().toISOString(), ...(data.label ? { label: data.label } : {}) };
  const { error } = await supabaseAdmin.from("projector_channels").update(payload).eq("id", existing.id);
  if (error) throw new Error(error.message);
  return { revision: payload.revision, updatedAt: payload.updated_at };
});

export const getProjectorScene = createServerFn({ method: "POST" }).inputValidator((data: unknown) => readSchema.parse(data)).handler(async ({ data }): Promise<ProjectorSnapshot> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("projector_channels").select("label, enabled, paused, scene, revision, updated_at").eq("token", data.token).maybeSingle();
  if (!row) return { status: "unknown", revision: 0, scene: null, updatedAt: null, label: null };
  const revision = Number(row.revision ?? 0);
  const base = { revision, updatedAt: row.updated_at, label: row.label } as const;
  const status: ProjectorStatus = !row.enabled ? "disabled" : row.paused ? "paused" : !row.scene ? "waiting" : Date.now() - new Date(row.updated_at).getTime() > 30_000 ? "stale" : "live";
  if (data.sinceRevision !== undefined && data.sinceRevision === revision) return { ...base, status: status === "live" ? "unchanged" : status, scene: null };
  const scene = (row.scene as SceneJson | null) ?? null;
  if (scene) await signSceneAssets(scene, supabaseAdmin);
  return { ...base, status, scene };
});

export const createMediaUploadUrl = createServerFn({ method: "POST" }).inputValidator((data: unknown) => uploadSchema.parse(data)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: channel } = await supabaseAdmin.from("projector_channels").select("id").eq("token", data.token).maybeSingle();
  if (!channel) throw new Error("Unknown projector code");
  const safeName = data.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${data.token}/${Date.now().toString(36)}_${safeName}`;
  const { data: signed, error } = await supabaseAdmin.storage.from("projector-media").createSignedUploadUrl(path);
  if (error || !signed) throw new Error(error?.message ?? "Could not create upload URL");
  return { path, signedUrl: signed.signedUrl, token: signed.token };
});

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")["supabaseAdmin"]>;

async function signSceneAssets(scene: SceneJson, admin: AdminClient) {
  const paths: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.startsWith("storage:")) paths.push(value.slice(8));
    else if (Array.isArray(value)) for (const item of value) collect(item);
    else if (value && typeof value === "object") for (const child of Object.values(value)) collect(child);
  };
  collect(scene);
  if (paths.length === 0) return;
  const uniquePaths = [...new Set(paths)];
  const { data: signed } = await admin.storage.from("projector-media").createSignedUrls(uniquePaths, 60 * 60 * 6);
  const map = new Map<string, string>();
  for (const entry of signed ?? []) if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  const resolve = (value: unknown): unknown => {
    if (typeof value === "string" && value.startsWith("storage:")) return map.get(value.slice(8)) ?? null;
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) (value as Record<string, unknown>)[key] = resolve(child);
    }
    return value;
  };
  resolve(scene);
}
