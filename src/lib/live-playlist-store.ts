import type { PlaylistItem, ProjectState } from "./projection-types";

const DB_NAME = "side-projection-liveoutput";
const STORE = "playlist";
const KEY = "active";
const MARKER = "liveasset:";

export interface LivePlaylistSnapshot {
  items: PlaylistItem[];
  loop: boolean;
  scenes: Record<string, ProjectState>;
}

interface StoredAsset { id: string; blob: Blob; }
interface StoredPlaylist { items: PlaylistItem[]; loop: boolean; scenes: Record<string, ProjectState>; assets: StoredAsset[]; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open live playlist store"));
  });
}

async function put(value: StoredPlaylist) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save live playlist"));
  });
  db.close();
}

async function get(): Promise<StoredPlaylist | null> {
  const db = await openDb();
  const value = await new Promise<StoredPlaylist | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as StoredPlaylist | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read live playlist"));
  });
  db.close();
  return value;
}

export async function clearLivePlaylist() {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb().catch(() => null);
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function persistLivePlaylist(snapshot: LivePlaylistSnapshot) {
  const assets: StoredAsset[] = [];
  const scenes: Record<string, ProjectState> = {};
  for (const [projectId, source] of Object.entries(snapshot.scenes)) {
    const scene: ProjectState = {
      ...source,
      assets: source.assets.map((asset) => ({ ...asset })),
      background: { ...source.background },
    };
    for (const asset of scene.assets) {
      if (!asset.url || !/^https?:\/\//.test(asset.url)) continue;
      try {
        const response = await fetch(asset.url);
        if (!response.ok) continue;
        assets.push({ id: `${projectId}:${asset.id}`, blob: await response.blob() });
        asset.url = `${MARKER}${projectId}:${asset.id}`;
      } catch {
        // Keep the signed URL as a fallback.
      }
    }
    if (scene.background.url && /^https?:\/\//.test(scene.background.url)) {
      try {
        const response = await fetch(scene.background.url);
        if (response.ok) {
          const id = `${projectId}:background`;
          assets.push({ id, blob: await response.blob() });
          scene.background.url = `${MARKER}${id}`;
        }
      } catch {
        // Keep the signed URL as a fallback.
      }
    }
    scenes[projectId] = scene;
  }
  await put({ items: snapshot.items, loop: snapshot.loop, scenes, assets });
}

export async function loadLivePlaylist(): Promise<LivePlaylistSnapshot | null> {
  const stored = await get().catch(() => null);
  if (!stored?.items?.length) return null;
  const urls = new Map<string, string>();
  for (const asset of stored.assets ?? []) urls.set(asset.id, URL.createObjectURL(asset.blob));
  const scenes: Record<string, ProjectState> = {};
  for (const [projectId, source] of Object.entries(stored.scenes ?? {})) {
    scenes[projectId] = {
      ...source,
      assets: source.assets.map((asset) => ({
        ...asset,
        url: asset.url.startsWith(MARKER) ? (urls.get(asset.url.slice(MARKER.length)) ?? asset.url) : asset.url,
      })),
      background: {
        ...source.background,
        url: source.background.url?.startsWith(MARKER)
          ? (urls.get(source.background.url.slice(MARKER.length)) ?? source.background.url)
          : source.background.url,
      },
    };
  }
  return { items: stored.items, loop: stored.loop, scenes };
}
