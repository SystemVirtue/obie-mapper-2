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

function smoothClosedPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
) {
  const n = pts.length;
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i += 1) {
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const end = mid(cur, next);
    ctx.quadraticCurveTo(cur.x, cur.y, end.x, end.y);
  }
  ctx.closePath();
}

function roundedClosedPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  radius: number,
) {
  const n = pts.length;
  ctx.moveTo((pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2);
  for (let i = 0; i < n; i += 1) {
    const cur = pts[(i + 1) % n]!;
    const next = pts[(i + 2) % n]!;
    ctx.arcTo(cur.x, cur.y, next.x, next.y, radius);
  }
  ctx.closePath();
}

function pathForNode(ctx: CanvasRenderingContext2D, node: ProjectionNode) {
  ctx.beginPath();
  if (node.kind === "polygon" && node.points.length >= 6) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < node.points.length; i += 2) {
      pts.push({ x: node.points[i] ?? 0, y: node.points[i + 1] ?? 0 });
    }
    if (node.tension > 0.02) {
      smoothClosedPath(ctx, pts);
    } else if (node.cornerRadius > 0.5) {
      roundedClosedPath(ctx, pts, node.cornerRadius);
    } else {
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    }
  } else if (node.cornerRadius > 0.5) {
    const r = Math.min(node.cornerRadius, node.width / 2, node.height / 2);
    ctx.roundRect(0, 0, node.width, node.height, r);
  } else {
    ctx.rect(0, 0, node.width, node.height);
  }
}

function drawTestPattern(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cell = Math.max(24, Math.round(Math.min(w, h) / 12));
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const on = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2;
      ctx.fillStyle = on ? "#1e293b" : "#0b1220";
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = `600 ${Math.round(cell / 2)}px system-ui, sans-serif`;
  ctx.fillText("TL", 12, cell / 2 + 8);
  ctx.textAlign = "right";
  ctx.fillText("TR", w - 12, cell / 2 + 8);
  ctx.fillText("BR", w - 12, h - 12);
  ctx.textAlign = "left";
  ctx.fillText("BL", 12, h - 12);
  ctx.textAlign = "start";
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

  if (state.testPattern) {
    drawTestPattern(ctx, state.stageWidth, state.stageHeight);
    ctx.restore();
    return;
  }

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

    if (state.xray) {
      // Alignment view: outlines only, no media.
      pathForNode(ctx, node);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      continue;
    }

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

