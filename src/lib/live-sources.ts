/**
 * Live inputs: microphone (level / bands / beat) and camera (image + motion).
 * Everything stays on the device — signals are never published.
 */

export interface LiveSignals {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  motion: number;
}

const zero: LiveSignals = { level: 0, bass: 0, mid: 0, treble: 0, beat: 0, motion: 0 };

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;
let freq: Uint8Array | null = null;

let cameraVideo: HTMLVideoElement | null = null;
let cameraStream: MediaStream | null = null;
let motionCanvas: HTMLCanvasElement | null = null;
let lastFrame: Uint8ClampedArray | null = null;
let motionValue = 0;
let lastMotionAt = 0;

let beatEnergy = 0;
let beatValue = 0;

export function micActive() {
  return Boolean(analyser);
}

export function cameraActive() {
  return Boolean(cameraStream);
}

export async function startMic(): Promise<boolean> {
  if (analyser) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    freq = new Uint8Array(analyser.frequencyBinCount);
    return true;
  } catch {
    stopMic();
    return false;
  }
}

export function stopMic() {
  micStream?.getTracks().forEach((t) => t.stop());
  void audioCtx?.close().catch(() => undefined);
  micStream = null;
  audioCtx = null;
  analyser = null;
  freq = null;
}

export async function startCamera(): Promise<boolean> {
  if (cameraStream) return true;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.srcObject = cameraStream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    await video.play().catch(() => undefined);
    cameraVideo = video;
    return true;
  } catch {
    stopCamera();
    return false;
  }
}

export function stopCamera() {
  cameraStream?.getTracks().forEach((t) => t.stop());
  cameraStream = null;
  cameraVideo = null;
  lastFrame = null;
  motionValue = 0;
}

export function getCameraElement(): HTMLVideoElement | null {
  return cameraVideo && cameraVideo.readyState >= 2 ? cameraVideo : null;
}

function sampleMotion() {
  const video = getCameraElement();
  if (!video) return;
  const now = performance.now();
  if (now - lastMotionAt < 100) return;
  lastMotionAt = now;
  if (!motionCanvas) {
    motionCanvas = document.createElement("canvas");
    motionCanvas.width = 48;
    motionCanvas.height = 27;
  }
  const ctx = motionCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, motionCanvas.width, motionCanvas.height);
  const frame = ctx.getImageData(0, 0, motionCanvas.width, motionCanvas.height).data;
  if (lastFrame && lastFrame.length === frame.length) {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 4) {
      sum += Math.abs((frame[i] ?? 0) - (lastFrame[i] ?? 0));
    }
    const avg = sum / (frame.length / 4) / 255;
    motionValue = motionValue * 0.6 + Math.min(1, avg * 6) * 0.4;
  }
  lastFrame = new Uint8ClampedArray(frame);
}

/** Current live signal values, all normalized 0..1. */
export function getSignals(): LiveSignals {
  sampleMotion();
  if (!analyser || !freq) return { ...zero, motion: motionValue };
  analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
  const bins = freq.length;
  const band = (from: number, to: number) => {
    let sum = 0;
    const a = Math.floor(bins * from);
    const b = Math.max(a + 1, Math.floor(bins * to));
    for (let i = a; i < b; i += 1) sum += freq![i] ?? 0;
    return sum / (b - a) / 255;
  };
  const bass = band(0, 0.08);
  const mid = band(0.08, 0.3);
  const treble = band(0.3, 0.8);
  const level = (bass + mid + treble) / 3;

  // Simple beat detector: bass energy jumping above its running average.
  const jump = bass - beatEnergy;
  beatEnergy = beatEnergy * 0.9 + bass * 0.1;
  beatValue = Math.max(beatValue * 0.85, jump > 0.08 ? 1 : 0);

  return { level, bass, mid, treble, beat: beatValue, motion: motionValue };
}
