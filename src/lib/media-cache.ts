import type { MediaAsset } from "./projection-types";

type MediaElement = HTMLImageElement | HTMLVideoElement;

const cache = new Map<string, MediaElement>();

/** Lazily create (and keep) a decoded image or looping muted video element. */
export function getMediaElement(asset: MediaAsset | null | undefined): MediaElement | null {
  if (!asset || typeof document === "undefined") return null;
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
  video.src = asset.url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  void video.play().catch(() => undefined);
  cache.set(asset.id, video);
  return video;
}

export function isReady(el: MediaElement | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLImageElement) return el.complete && el.naturalWidth > 0;
  return el.readyState >= 2 && el.videoWidth > 0;
}

export function hasVideo(assets: MediaAsset[]): boolean {
  return assets.some((a) => a.kind === "video");
}
