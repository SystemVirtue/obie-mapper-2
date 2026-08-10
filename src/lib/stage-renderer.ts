import { getMediaElement, isReady } from "./media-cache";
import type { MediaAsset, ProjectionNode, ProjectState } from "./projection-types";

interface Note {
  x: number;
  y: number;
  speed: number;
  size: number;
  drift: number;
  glyph: string;
}

const noteFields = new Map<string, Note[]>();
const GLYPHS = ["\u266A", "\u266B", "\u2669", "\u266C"];

function noteField(node: ProjectionNode): Note[] {
  const existing = noteFields.get(node.id);
  if (existing) return existing;
  const notes: Note[] = Array.from({ length: 18 }, (_, i) => ({
    x: Math.random() * node.width,
    y: Math.random() * node.height,
    speed: 12 + Math.random() * 26,
    size: 14 + Math.random() * 26,
    drift: 6 + Math.random() * 18,
    glyph: GLYPHS[i % GLYPHS.length] ?? "\u266A",
  }));
  noteFields.set(node.id, notes);
  return notes;
}

function pulse(node: ProjectionNode, time: number): number {
  if (!node.triggerSeconds || node.triggerSeconds <= 0) return 1;
  const phase = (time % node.triggerSeconds) / node.triggerSeconds;
  return 1 + 0.06 * Math.sin(phase * Math.PI * 2);
}

function drawMediaFill(
  ctx: CanvasRenderingContext2D,
  node: ProjectionNode,
  assets: MediaAsset[],
) {
  if (node.media === "color") {
    ctx.fillStyle = node.color;
    ctx.fill();
    return;
  }
  const asset = assets.find((a) => a.id === node.assetId) ?? null;
  const el = getMediaElement(asset);
  if (!isReady(el) || !el) {
    ctx.fillStyle = node.color;
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.clip();
  const sw = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
  const sh = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
  const scale = Math.max(node.width / sw, node.height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(el, (node.width - dw) / 2, (node.height - dh) / 2, dw, dh);
  ctx.restore();
}

function pathForNode(ctx: CanvasRenderingContext2D, node: ProjectionNode) {
  ctx.beginPath();
  if (node.kind === "polygon" && node.points.length >= 6) {
    for (let i = 0; i < node.points.length; i += 2) {
      const px = node.points[i] ?? 0;
      const py = node.points[i + 1] ?? 0;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.rect(0, 0, node.width, node.height);
  }
}

/**
 * Draw the full projection scene (nodes only, black surround) into a 2D canvas.
 * This canvas becomes the WebGL source texture for the homography warp.
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  state: ProjectState,
  time: number,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, state.stageWidth, state.stageHeight);

  for (const node of state.nodes) {
    if (!node.visible) continue;
    const scale = pulse(node, time);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, node.opacity));
    ctx.translate(node.x, node.y);
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(node.width / 2, node.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-node.width / 2, -node.height / 2);

    if (node.glow) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 10 + node.glowIntensity * 60;
    }

    if (node.kind === "particles") {
      ctx.fillStyle = node.color;
      ctx.font = "600 24px system-ui, sans-serif";
      for (const note of noteField(node)) {
        const y = node.height - ((note.y + time * note.speed) % (node.height + 40));
        const x = note.x + Math.sin((time + note.x) * 0.8) * note.drift;
        ctx.font = `600 ${note.size}px system-ui, sans-serif`;
        ctx.fillText(note.glyph, x, y);
      }
    } else {
      pathForNode(ctx, node);
      drawMediaFill(ctx, node, state.assets);
    }

    ctx.restore();
  }

  ctx.restore();
}
