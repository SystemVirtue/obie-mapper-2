import type { ProjectState } from "./projection-types";

const DB_NAME = "side-projection-liveoutput";
const STORE = "playlist";
const KEY = "active";
const MARKER = "liveasset:";

interface StoredAsset { id: string; blob: Blob; }
interface StoredPlaylist { scenes: ProjectState[]; assets: StoredAsset[]; }

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

export async function persistLivePlaylist(scenes: ProjectState[]) {
  const assets: StoredAsset[] = [];
  const storedScenes = scenes.map((scene) => ({
    ...scene,
    assets: scene.assets.map((asset) => ({ ...asset })),
    background: { ...scene.background },
  }));

  for (const scene of storedScenes) {
    for (const asset of scene.assets) {
      if (!asset.url || !/^https?:\/\//.test(asset.url)) continue;
      try {
        const response = await fetch(asset.url);
        if (!response.ok) continue;
        assets.push({ id: asset.id, blob: await response.blob() });
        asset.url = `${MARKER}${asset.id}`;
      } catch {
        // Keep the remote URL as a fallback if the browser cannot cache it.
      }
    }
    if (scene.background.url && /^https?:\/\//.test(scene.background.url)) {
      try {
        const response = await fetch(scene.background.url);
        if (response.ok) {
          const id = `background-${scene.name || "scene"}-${assets.length}`;
          assets.push({ id, blob: await response.blob() });
          scene.background.url = `${MARKER}${id}`;
        }
      } catch {
        // Keep the remote URL as a fallback.
      }
    }
  }

  await put({ scenes: storedScenes, assets });
}

export async function loadLivePlaylist(): Promise<ProjectState[] | null> {
  const stored = await get().catch(() => null);
  if (!stored?.scenes?.length) return null;
  const urls = new Map<string, string>();
  for (const asset of stored.assets ?? []) urls.set(asset.id, URL.createObjectURL(asset.blob));
  return stored.scenes.map((scene) => ({
    ...scene,
    assets: scene.assets.map((asset) => ({
      ...asset,
      url: asset.url.startsWith(MARKER) ? (urls.get(asset.url.slice(MARKER.length)) ?? asset.url) : asset.url,
    })),
    background: {
      ...scene.background,
      url: scene.background.url?.startsWith(MARKER)
        ? (urls.get(scene.background.url.slice(MARKER.length)) ?? scene.background.url)
        : scene.background.url,
    },
  }));
}
