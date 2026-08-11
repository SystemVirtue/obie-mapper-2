import type { MediaAsset, ProjectState } from "./projection-types";

/**
 * Local project persistence: named scenes (full editor state, corner pins,
 * gains, layers) plus their media binaries live in IndexedDB, so nothing
 * leaves the machine and object URLs can be rebuilt on load.
 */

const DB_NAME = "side-projection-suite";
const STORE = "projects";
const VERSION = 1;

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  nodeCount: number;
  assetCount: number;
}

interface StoredAsset {
  id: string;
  name: string;
  kind: "image" | "video";
  blob: Blob;
}

interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  /** State with all object URLs stripped (they are recreated from blobs). */
  state: ProjectState;
  assets: StoredAsset[];
  background: Blob | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open project store"));
  });
}

function run<T>(store: IDBObjectStore, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project store request failed"));
    void store;
  });
}

async function urlToBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    return await response.blob();
  } catch {
    return null;
  }
}

export function newProjectId() {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function saveProject(
  id: string,
  name: string,
  state: ProjectState,
): Promise<ProjectSummary> {
  const assets: StoredAsset[] = [];
  for (const asset of state.assets) {
    const blob = await urlToBlob(asset.url);
    if (blob) assets.push({ id: asset.id, name: asset.name, kind: asset.kind, blob });
  }
  const background = await urlToBlob(state.background.url);

  const record: ProjectRecord = {
    id,
    name,
    updatedAt: Date.now(),
    state: {
      ...state,
      name,
      assets: state.assets.map((a) => ({ ...a, url: "" })),
      background: { ...state.background, url: null },
    },
    assets,
    background,
  };

  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await run(tx.objectStore(STORE), tx.objectStore(STORE).put(record));
  db.close();

  return {
    id,
    name,
    updatedAt: record.updatedAt,
    nodeCount: state.nodes.length,
    assetCount: assets.length,
  };
}

function hydrate(record: ProjectRecord): ProjectState {
  const assetUrls = new Map<string, string>();
  for (const asset of record.assets) {
    assetUrls.set(asset.id, URL.createObjectURL(asset.blob));
  }
  const assets: MediaAsset[] = record.assets.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    url: assetUrls.get(a.id) ?? "",
  }));

  return {
    ...record.state,
    name: record.name,
    assets,
    background: {
      ...record.state.background,
      url: record.background ? URL.createObjectURL(record.background) : null,
    },
  };
}

export async function loadProject(id: string): Promise<ProjectState | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const record = await run(tx.objectStore(STORE), tx.objectStore(STORE).get(id) as IDBRequest<ProjectRecord | undefined>);
  db.close();
  return record ? hydrate(record) : null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const records = await run(
    tx.objectStore(STORE),
    tx.objectStore(STORE).getAll() as IDBRequest<ProjectRecord[]>,
  );
  db.close();
  return records
    .map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
      nodeCount: r.state.nodes.length,
      assetCount: r.assets.length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await run(tx.objectStore(STORE), tx.objectStore(STORE).delete(id));
  db.close();
}

export async function duplicateProject(id: string): Promise<ProjectSummary | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const record = await run(
    tx.objectStore(STORE),
    tx.objectStore(STORE).get(id) as IDBRequest<ProjectRecord | undefined>,
  );
  db.close();
  if (!record) return null;
  const copy: ProjectRecord = {
    ...record,
    id: newProjectId(),
    name: `${record.name} copy`,
    updatedAt: Date.now(),
  };
  const db2 = await openDb();
  const tx2 = db2.transaction(STORE, "readwrite");
  await run(tx2.objectStore(STORE), tx2.objectStore(STORE).put(copy));
  db2.close();
  return {
    id: copy.id,
    name: copy.name,
    updatedAt: copy.updatedAt,
    nodeCount: copy.state.nodes.length,
    assetCount: copy.assets.length,
  };
}

/* ---------- Portable JSON export / import (assets inlined as data URLs) ---------- */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to encode media"));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  }
}

export interface ProjectFile {
  format: "side-projection-suite";
  version: 1;
  name: string;
  state: ProjectState;
  assets: { id: string; name: string; kind: "image" | "video"; dataUrl: string }[];
  background: string | null;
}

export async function exportProjectFile(name: string, state: ProjectState): Promise<string> {
  const assets: ProjectFile["assets"] = [];
  for (const asset of state.assets) {
    const blob = await urlToBlob(asset.url);
    if (blob) {
      assets.push({
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        dataUrl: await blobToDataUrl(blob),
      });
    }
  }
  const bgBlob = await urlToBlob(state.background.url);
  const file: ProjectFile = {
    format: "side-projection-suite",
    version: 1,
    name,
    state: {
      ...state,
      name,
      assets: state.assets.map((a) => ({ ...a, url: "" })),
      background: { ...state.background, url: null },
    },
    assets,
    background: bgBlob ? await blobToDataUrl(bgBlob) : null,
  };
  return JSON.stringify(file);
}

export async function importProjectFile(text: string): Promise<{ name: string; state: ProjectState }> {
  const parsed = JSON.parse(text) as ProjectFile;
  if (parsed?.format !== "side-projection-suite" || !parsed.state) {
    throw new Error("Not a valid project file");
  }
  const assets: MediaAsset[] = [];
  for (const asset of parsed.assets ?? []) {
    const blob = await dataUrlToBlob(asset.dataUrl);
    if (blob) {
      assets.push({ id: asset.id, name: asset.name, kind: asset.kind, url: URL.createObjectURL(blob) });
    }
  }
  const bg = parsed.background ? await dataUrlToBlob(parsed.background) : null;
  return {
    name: parsed.name,
    state: {
      ...parsed.state,
      name: parsed.name,
      assets,
      background: {
        ...parsed.state.background,
        url: bg ? URL.createObjectURL(bg) : null,
      },
    },
  };
}
