export type NodeKind = "rect" | "polygon" | "particles";
export type MediaKind = "color" | "image" | "video" | "shader" | "camera";

/** Canvas-supported layer blend modes (OBS-style compositing). */
export const BLEND_MODES = [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn",
  "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity", "lighter",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const REACT_SOURCES = ["none", "level", "bass", "mid", "treble", "beat", "motion"] as const;
export type ReactSource = (typeof REACT_SOURCES)[number];
export const REACT_TARGETS = ["scale", "opacity", "glow", "speed", "rotation"] as const;
export type ReactTarget = (typeof REACT_TARGETS)[number];

export interface ProjectionNode {
  id: string; name: string; kind: NodeKind; visible: boolean; locked: boolean;
  x: number; y: number; width: number; height: number; rotation: number;
  points: number[]; sides: number; tension: number; cornerRadius: number;
  media: MediaKind; color: string; assetId: string | null; opacity: number;
  glow: boolean; glowIntensity: number; triggerSeconds: number; blendMode: BlendMode; solo: boolean;
  reactSource: ReactSource; reactTarget: ReactTarget; reactAmount: number;
}

export interface MediaAsset {
  id: string; name: string; kind: "image" | "video" | "shader" | "camera"; url: string;
  code?: string; source?: string;
}

export interface CornerPin { x: number; y: number; }
export type OutputMode = "current" | "playlist" | "hidden" | "pattern";
export interface PlaylistItem { projectId: string; name: string; seconds: number; fade: number; }

export interface ProjectState {
  name: string;
  stageWidth: number; stageHeight: number;
  /** Physical mapped surface dimensions in metres. */
  wallWidthM: number; wallHeightM: number;
  /** Projector throw/depth from lens to mapped surface in metres. */
  throwDepthM: number;
  /** Exact projector output canvas dimensions in pixels. Corner pins are entered against these dimensions. */
  outputWidth: number; outputHeight: number;
  background: { url: string | null; opacity: number; visible: boolean };
  nodes: ProjectionNode[]; assets: MediaAsset[]; selectedId: string | null;
  /** Normalized 0..1 projector-space pins: TL, TR, BR, BL. */
  corners: CornerPin[];
  gainLeft: number; gainRight: number; showGrid: boolean; brightness: number; xray: boolean; testPattern: boolean;
  outputMode: OutputMode; playlist: PlaylistItem[]; playlistLoop: boolean;
}

export const DEFAULT_CORNERS: CornerPin[] = [
  { x: 0.06, y: 0.12 }, { x: 0.94, y: 0.04 }, { x: 0.94, y: 0.96 }, { x: 0.06, y: 0.88 },
];

export function createDefaultState(): ProjectState {
  return {
    name: "Untitled scene", stageWidth: 1280, stageHeight: 720,
    wallWidthM: 8, wallHeightM: 4.5, throwDepthM: 5,
    outputWidth: 1920, outputHeight: 1080,
    background: { url: null, opacity: 0.6, visible: true }, nodes: [], assets: [], selectedId: null,
    corners: DEFAULT_CORNERS.map((c) => ({ ...c })), gainLeft: 0.55, gainRight: 1, showGrid: true,
    brightness: 1, xray: false, testPattern: false, outputMode: "current", playlist: [], playlistLoop: true,
  };
}

export function normalizeState(input: ProjectState): ProjectState {
  const base = createDefaultState();
  return {
    ...base, ...input,
    throwDepthM: Number.isFinite(input.throwDepthM) ? input.throwDepthM : base.throwDepthM,
    outputMode: input.outputMode ?? base.outputMode,
    playlist: Array.isArray(input.playlist) ? input.playlist : [], playlistLoop: input.playlistLoop ?? true,
    assets: (input.assets ?? []).map((a) => ({ ...a })),
    nodes: (input.nodes ?? []).map((n) => ({
      ...n, blendMode: n.blendMode ?? "normal", solo: n.solo ?? false,
      reactSource: n.reactSource ?? "none", reactTarget: n.reactTarget ?? "scale", reactAmount: n.reactAmount ?? 0.5,
    })),
  };
}

let counter = 0;
function nextId(prefix: string) { counter += 1; return `${prefix}_${Date.now().toString(36)}_${counter}`; }
export const MIN_POLYGON_SIDES = 3; export const MAX_POLYGON_SIDES = 12; export const DEFAULT_POLYGON_SIDES = 4;

export function polygonPoints(sides: number, width: number, height: number): number[] {
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(sides)));
  const rx = width / 2, ry = height / 2, start = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0), pts: number[] = [];
  for (let i = 0; i < n; i += 1) { const a = start + (i * Math.PI * 2) / n; pts.push(rx + rx * Math.cos(a), ry + ry * Math.sin(a)); }
  return pts;
}

export function createNode(kind: NodeKind, index: number): ProjectionNode {
  const base: ProjectionNode = {
    id: nextId(kind), name: kind === "rect" ? `Window ${index + 1}` : kind === "polygon" ? `Shape ${index + 1}` : `Notes ${index + 1}`,
    kind, visible: true, locked: false, x: 120 + index * 24, y: 120 + index * 18, width: 320, height: 200, rotation: 0,
    points: [], sides: DEFAULT_POLYGON_SIDES, tension: 0, cornerRadius: 0, media: "color", color: "#5eead4", assetId: null,
    opacity: 1, glow: false, glowIntensity: 0.6, triggerSeconds: 0, blendMode: "normal", solo: false,
    reactSource: "none", reactTarget: "scale", reactAmount: 0.5,
  };
  if (kind === "polygon") { base.width = 300; base.height = 220; base.points = polygonPoints(DEFAULT_POLYGON_SIDES, 300, 220); base.color = "#a78bfa"; }
  if (kind === "particles") { base.color = "#fcd34d"; base.width = 260; base.height = 260; }
  return base;
}
export function newAssetId() { return nextId("asset"); }
export function duplicateNode(node: ProjectionNode): ProjectionNode { return { ...node, id: nextId(node.kind), name: `${node.name} copy`, x: node.x + 24, y: node.y + 24, points: [...node.points] }; }
