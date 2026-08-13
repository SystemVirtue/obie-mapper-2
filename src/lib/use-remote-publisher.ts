import { useCallback, useEffect, useRef, useState } from "react";

import {
  createMediaUploadUrl,
  publishProjectorScene,
  type SceneJson,
} from "./projector.functions";
import type { ProjectState } from "./projection-types";

export type PublishPhase = "idle" | "uploading" | "publishing" | "ok" | "error";

/** original local url -> `storage:<path>` reference (per session). */
const uploadCache = new Map<string, string>();

async function uploadOne(token: string, url: string, name: string): Promise<string | null> {
  const cached = uploadCache.get(url);
  if (cached) return cached;
  if (!url || url.startsWith("storage:")) return url || null;
  if (!/^(blob:|data:)/.test(url)) return url; // already a remote URL

  const blob = await fetch(url).then((r) => r.blob());
  const { path, signedUrl } = await createMediaUploadUrl({
    data: { token, fileName: name || "media", contentType: blob.type || "application/octet-stream" },
  });
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const ref = `storage:${path}`;
  uploadCache.set(url, ref);
  return ref;
}

/** Copy the scene, swapping local blob media for uploaded storage references. */
async function prepareScene(state: ProjectState, token: string): Promise<SceneJson> {
  const assets = await Promise.all(
    state.assets.map(async (asset) => ({
      ...asset,
      url: (await uploadOne(token, asset.url, asset.name)) ?? asset.url,
    })),
  );

  const backgroundUrl = state.background.url
    ? await uploadOne(token, state.background.url, "background")
    : null;

  const scene: ProjectState = {
    ...state,
    assets,
    background: { ...state.background, url: backgroundUrl },
    selectedId: null,
  };
  return scene as unknown as SceneJson;
}

interface Options {
  token: string | null;
  enabled: boolean;
  paused: boolean;
  label: string;
}

/**
 * Publishes editor state to the remote projector channel: debounced on change
 * plus a 10s heartbeat so the remote endpoint can tell live from stale.
 */
export function useRemotePublisher(state: ProjectState, { token, enabled, paused, label }: Options) {
  const [phase, setPhase] = useState<PublishPhase>("idle");
  const [publishedAt, setPublishedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(false);
  const pending = useRef(false);

  const publish = useCallback(async () => {
    if (!token || !enabled) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    try {
      setPhase("uploading");
      const scene = await prepareScene(stateRef.current, token);
      setPhase("publishing");
      await publishProjectorScene({ data: { token, scene, enabled: true, paused, label } });
      setPublishedAt(Date.now());
      setError(null);
      setPhase("ok");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publish failed");
      setPhase("error");
    } finally {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        void publish();
      }
    }
  }, [enabled, label, paused, token]);

  // Debounced publish on every state change.
  useEffect(() => {
    if (!token || !enabled) return;
    const timer = window.setTimeout(() => void publish(), 700);
    return () => window.clearTimeout(timer);
  }, [enabled, publish, state, token]);

  // Heartbeat keeps `updated_at` fresh so the remote knows the studio is live.
  useEffect(() => {
    if (!token || !enabled) return;
    const id = window.setInterval(() => void publish(), 10_000);
    return () => window.clearInterval(id);
  }, [enabled, publish, token]);

  return { phase, publishedAt, error, publishNow: publish };
}
