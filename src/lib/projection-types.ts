export type NodeKind = "rect" | "polygon" | "particles";
export type MediaKind = "color" | "image" | "video";

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
  media: MediaKind;
  color: string;
  assetId: string | null;
  opacity: number;
  glow: boolean;
  glowIntensity: number;
  /** Trigger a pulse animation every N seconds (0 = off) */
  triggerSeconds: number;
}


export interface MediaAsset {
  id: string;
  name: string;
  kind: "image" | "video";
  url: string;
}

export interface CornerPin {
  x: number;
  y: number;
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
    media: "color",
    color: "#5eead4",
    assetId: null,
    opacity: 1,
    glow: false,
    glowIntensity: 0.6,
    triggerSeconds: 0,
  };

  if (kind === "polygon") {
    base.points = [0, 0, 300, 40, 260, 220, 30, 180];
    base.width = 300;
    base.height = 220;
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
