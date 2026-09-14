export type NodeKind = "rect" | "polygon" | "particles";
export type MediaKind = "color" | "image" | "video" | "shader" | "camera";

/** Canvas-supported layer blend modes (OBS-style compositing). */
export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "lighter",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** Live signal that can drive a layer property. */
export const REACT_SOURCES = ["none", "level", "bass", "mid", "treble", "beat", "motion"] as const;
export type ReactSource = (typeof REACT_SOURCES)[number];

export const REACT_TARGETS = ["scale", "opacity", "glow", "speed", "rotation"] as const;
export type ReactTarget = (typeof REACT_TARGETS)[number];


export interface ProjectionNode {
  id: string;
  name: string;
  kind: NodeKind;
  visible: boolean;
  /** Locked nodes cannot be dragged or transformed on the stage. */
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Local points (relative to x/y) for polygon nodes: [x0,y0,x1,y1,...] */
  points: number[];
  /** Number of polygon vertices (3..12) */
  sides: number;
  /** Spline smoothing amount 0..1 (0 = straight edges, higher = bezier curves) */
  tension: number;
  /** Rounded corner radius in stage px (rect nodes and polygon vertices) */
  cornerRadius: number;
  media: MediaKind;
  color: string;
  assetId: string | null;
  opacity: number;
  glow: boolean;
  glowIntensity: number;
  /** Trigger a pulse animation every N seconds (0 = off) */
  triggerSeconds: number;
  /** Compositing mode against the layers below */
  blendMode: BlendMode;
  /** Solo: when any layer is soloed, only soloed layers render */
  solo: boolean;
  /** Live signal driving a property (mic / camera) */
  reactSource: ReactSource;
  reactTarget: ReactTarget;
  /** How strongly the signal moves the property (0..1) */
  reactAmount: number;
}


export interface MediaAsset {
  id: string;
  name: string;
  kind: "image" | "video" | "shader" | "camera";
  url: string;
  /** GLSL fragment source (Shadertoy-style mainImage) for shader assets */
  code?: string;
  /** Credit / origin for imported open-source visuals */
  source?: string;
}

export interface CornerPin {
  x: number;
  y: number;
}

export type OutputMode = "current" | "playlist" | "hidden" | "pattern";

export interface PlaylistItem {
  /** Saved scene id in the local project store */
  projectId: string;
  name: string;
  /** Seconds on screen */
  seconds: number;
  /** Fade-through-black duration in seconds */
  fade: number;
}

export interface ProjectState {
  /** Scene name (matches the saved project record) */
  name: string;
  /** Stage size in pixels (derived from wall meters + resolution) */
  stageWidth: number;
  stageHeight: number;
  wallWidthM: number;
  wallHeightM: number;
  outputWidth: number;
  outputHeight: number;
  background: { url: string | null; opacity: number; visible: boolean };
  nodes: ProjectionNode[];
  assets: MediaAsset[];
  selectedId: string | null;
  /** Normalized 0..1 corner pins in projector space: TL, TR, BR, BL */
  corners: CornerPin[];
  /** Horizontal brightness gain: left (near throw) and right (far throw) */
  gainLeft: number;
  gainRight: number;
  showGrid: boolean;
  /** Global output brightness multiplier (0..2) */
  brightness: number;
  /** Outline-only alignment view */
  xray: boolean;
  /** Calibration test pattern overlay on the output */
  testPattern: boolean;
  /** What the live output shows */
  outputMode: OutputMode;
  /** Scene sequence for playlist mode */
  playlist: PlaylistItem[];
  playlistLoop: boolean;
}


export const DEFAULT_CORNERS: CornerPin[] = [
  { x: 0.06, y: 0.12 },
  { x: 0.94, y: 0.04 },
  { x: 0.94, y: 0.96 },
  { x: 0.06, y: 0.88 },
];

export function createDefaultState(): ProjectState {
  return {
    name: "Untitled scene",
    stageWidth: 1280,
    stageHeight: 720,
    wallWidthM: 8,
    wallHeightM: 4.5,
    outputWidth: 1920,
    outputHeight: 1080,
    background: { url: null, opacity: 0.6, visible: true },
    nodes: [],
    assets: [],
    selectedId: null,
    corners: DEFAULT_CORNERS.map((c) => ({ ...c })),
    gainLeft: 0.55,
    gainRight: 1,
    showGrid: true,
    brightness: 1,
    xray: false,
    testPattern: false,
  };
}


let counter = 0;
function nextId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export const MIN_POLYGON_SIDES = 3;
export const MAX_POLYGON_SIDES = 12;
export const DEFAULT_POLYGON_SIDES = 4;

/** Regular polygon vertices inscribed in a width x height box, first point at top. */
export function polygonPoints(sides: number, width: number, height: number): number[] {
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(sides)));
  const rx = width / 2;
  const ry = height / 2;
  const start = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
  const pts: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = start + (i * Math.PI * 2) / n;
    pts.push(rx + rx * Math.cos(a), ry + ry * Math.sin(a));
  }
  return pts;
}

export function createNode(kind: NodeKind, index: number): ProjectionNode {
  const base: ProjectionNode = {
    id: nextId(kind),
    name:
      kind === "rect"
        ? `Window ${index + 1}`
        : kind === "polygon"
          ? `Shape ${index + 1}`
          : `Notes ${index + 1}`,
    kind,
    visible: true,
    locked: false,

    x: 120 + index * 24,
    y: 120 + index * 18,
    width: 320,
    height: 200,
    rotation: 0,
    points: [],
    sides: DEFAULT_POLYGON_SIDES,
    tension: 0,
    cornerRadius: 0,
    media: "color",
    color: "#5eead4",
    assetId: null,
    opacity: 1,
    glow: false,
    glowIntensity: 0.6,
    triggerSeconds: 0,
  };

  if (kind === "polygon") {
    base.width = 300;
    base.height = 220;
    base.points = polygonPoints(DEFAULT_POLYGON_SIDES, 300, 220);
    base.color = "#a78bfa";
  }
  if (kind === "particles") {
    base.color = "#fcd34d";
    base.width = 260;
    base.height = 260;
  }
  return base;
}

export function newAssetId() {
  return nextId("asset");
}

/** Clone a node with a fresh id, nudged so it is visible on top of the original. */
export function duplicateNode(node: ProjectionNode): ProjectionNode {
  return {
    ...node,
    id: nextId(node.kind),
    name: `${node.name} copy`,
    x: node.x + 24,
    y: node.y + 24,
    points: [...node.points],
  };
}
