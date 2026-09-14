import { getCameraElement } from "./live-sources";
import type { MediaAsset } from "./projection-types";
import { getShaderCanvas } from "./shader-source";

export type MediaElement = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

const cache = new Map<string, MediaElement>();

/** Lazily create (and keep) the element that backs an asset. */
export function getMediaElement(asset: MediaAsset | null | undefined): MediaElement | null {
  if (!asset || typeof document === "undefined") return null;

  if (asset.kind === "camera") return getCameraElement();
  if (asset.kind === "shader") return getShaderCanvas(asset.id, asset.code ?? "");

  const existing = cache.get(asset.id);
  if (existing) return existing;

  if (asset.kind === "image") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = asset.url;
    cache.set(asset.id, img);
    return img;
  }

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.src = asset.url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  void video.play().catch(() => undefined);
  cache.set(asset.id, video);
  return video;
}

/** Intrinsic pixel size of a media element (0 when not ready). */
export function mediaSize(el: MediaElement | null): { width: number; height: number } {
  if (!el) return { width: 0, height: 0 };
  if (el instanceof HTMLImageElement) return { width: el.naturalWidth, height: el.naturalHeight };
  if (el instanceof HTMLCanvasElement) return { width: el.width, height: el.height };
  return { width: el.videoWidth, height: el.videoHeight };
}

export function isReady(el: MediaElement | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLImageElement) return el.complete && el.naturalWidth > 0;
  if (el instanceof HTMLCanvasElement) return el.width > 0 && el.height > 0;
  return el.readyState >= 2 && el.videoWidth > 0;
}

export function hasVideo(assets: MediaAsset[]): boolean {
  return assets.some((a) => a.kind === "video" || a.kind === "shader" || a.kind === "camera");
}
