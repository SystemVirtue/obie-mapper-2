import { useCallback, useEffect, useRef, useState } from "react";
import { loadProject } from "./project-store";
import { createMediaUploadUrl, publishProjectorScene, type SceneJson } from "./projector.functions";
import type { ProjectState } from "./projection-types";

export type PublishPhase = "idle" | "uploading" | "publishing" | "ok" | "error";
const uploadCache = new Map<string, string>();

function mediaTypeFor(name: string, blobType: string) {
  const normalized = blobType.split(";")[0]?.trim().toLowerCase();
  if (/^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime))$/.test(normalized)) return normalized;
  const ext = name.toLowerCase().split(".").pop();
  const byExt: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
  return byExt[ext ?? ""] ?? normalized;
}

async function uploadOne(token: string, url: string, name: string): Promise<string | null> {
  const cached = uploadCache.get(url); if (cached) return cached;
  if (!url || url.startsWith("storage:")) return url || null;
  if (!/^(blob:|data:)/.test(url)) return url;
  const blob = await fetch(url).then((r) => r.blob());
  const contentType = mediaTypeFor(name, blob.type || "");
  if (!/^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime))$/.test(contentType)) throw new Error(`Unsupported media type for “${name}”. Use PNG, JPEG, WebP, GIF, AVIF, MP4, WebM, or MOV.`);
  const { path, signedUrl } = await createMediaUploadUrl({ data: { token, fileName: name || "media", contentType } });
  const res = await fetch(signedUrl, { method: "PUT", headers: { "content-type": contentType }, body: blob });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const ref = `storage:${path}`; uploadCache.set(url, ref); return ref;
}

async function prepareScene(state: ProjectState, token: string): Promise<SceneJson> {
  const assets = await Promise.all(state.assets.map(async (asset) => {
    // Code-only assets (shaders, camera/live sources, generated visuals) are
    // already self-contained and must not be sent through media storage.
    if (asset.kind !== "image" && asset.kind !== "video") return asset;
    return { ...asset, url: (await uploadOne(token, asset.url, asset.name)) ?? asset.url };
  }));
  const backgroundUrl = state.background.url ? await uploadOne(token, state.background.url, "background") : null;
  const scene: ProjectState = { ...state, assets, background: { ...state.background, url: backgroundUrl }, selectedId: null };
  return scene as unknown as SceneJson;
}

async function preparePlaylist(state: ProjectState, token: string) {
  if (state.outputMode !== "playlist" || state.playlist.length === 0) return null;
  const scenes: Record<string, SceneJson> = {};
  for (const item of state.playlist) {
    const project = await loadProject(item.projectId);
    if (!project) continue;
    scenes[item.projectId] = await prepareScene(project, token);
  }
  return {
    items: state.playlist,
    loop: state.playlistLoop,
    scenes,
  };
}

async function preparePublishPayload(state: ProjectState, token: string): Promise<SceneJson> {
  const scene = await prepareScene(state, token);
  const playlist = await preparePlaylist(state, token);
  if (playlist) (scene as Record<string, unknown>).__livePlaylist = playlist;
  return scene;
}

interface Options { token: string | null; enabled: boolean; paused: boolean; label: string; }
export function useRemotePublisher(state: ProjectState, { token, enabled, paused, label }: Options) {
  const [phase, setPhase] = useState<PublishPhase>("idle"); const [publishedAt, setPublishedAt] = useState<number | null>(null); const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state); stateRef.current = state; const inFlight = useRef(false); const pending = useRef(false);
  const publish = useCallback(async () => {
    if (!token || !enabled) return;
    if (inFlight.current) { pending.current = true; return; }
    inFlight.current = true;
    try { setPhase("uploading"); const scene = await preparePublishPayload(stateRef.current, token); setPhase("publishing"); await publishProjectorScene({ data: { token, scene, enabled: true, paused, label } }); setPublishedAt(Date.now()); setError(null); setPhase("ok"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Publish failed"); setPhase("error"); }
    finally { inFlight.current = false; if (pending.current) { pending.current = false; void publish(); } }
  }, [enabled, label, paused, token]);
  useEffect(() => { if (!token || !enabled) return; const timer = window.setTimeout(() => void publish(), 700); return () => window.clearTimeout(timer); }, [enabled, publish, state, token]);
  useEffect(() => { if (!token || !enabled) return; const id = window.setInterval(() => void publish(), 10000); return () => window.clearInterval(id); }, [enabled, publish, token]);
  return { phase, publishedAt, error, publishNow: publish };
}
