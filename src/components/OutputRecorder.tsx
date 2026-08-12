import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";

interface Props {
  /** Returns the live output canvas to record. */
  getCanvas: () => HTMLCanvasElement | null;
  fps?: number;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    'video/mp4;codecs="avc1.42E01E"',
    "video/mp4",
    'video/webm;codecs="vp9"',
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Records the projector output canvas to a downloadable MP4 (WebM fallback). */
export default function OutputRecorder({ getCanvas, fps = 30 }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof MediaRecorder !== "undefined" && Boolean(pickMimeType());

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  const start = useCallback(() => {
    setError(null);
    const canvas = getCanvas();
    if (!canvas) {
      setError("Output canvas not ready yet");
      return;
    }
    const mimeType = pickMimeType();
    try {
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes("mp4") ? "mp4" : "webm";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `projection-output-${Date.now()}.${extension}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        chunksRef.current = [];
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed to start");
    }
  }, [fps, getCanvas]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => recorderRef.current?.stop(), []);

  if (!supported) {
    return <p className="text-[10px] text-muted-foreground">Recording unsupported in this browser</p>;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold ${
          recording
            ? "border-destructive bg-destructive/20 text-foreground"
            : "border-border bg-card/80 text-foreground"
        }`}
      >
        {recording ? <Square className="size-3" /> : <Circle className="size-3 text-destructive" />}
        {recording ? `Stop & save (${seconds}s)` : "Record output MP4"}
      </button>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
