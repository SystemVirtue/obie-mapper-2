import { useCallback, useEffect, useRef, useState } from "react";
import { Cast, Copy, Pause, Play, RefreshCw, Wifi, WifiOff } from "lucide-react";
import QRCode from "qrcode";

import { ensureProjectorChannel } from "@/lib/projector.functions";
import {
  LIVE_OUTPUT_TOKEN,
  getRemoteEnabled,
  getRemotePaused,
  projectorUrl,
  setRemoteEnabled,
  setRemotePaused,
} from "@/lib/projector-link";
import type { ProjectState } from "@/lib/projection-types";
import { useRemotePublisher } from "@/lib/use-remote-publisher";
import { useCast } from "@/lib/use-cast";

interface Props { state: ProjectState; }

export default function RemoteProjectorPanel({ state }: Props) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const provisioning = useRef(false);

  useEffect(() => {
    setEnabled(getRemoteEnabled());
    setPaused(getRemotePaused());
    if (provisioning.current) return;
    provisioning.current = true;
    void ensureProjectorChannel({ data: { token: LIVE_OUTPUT_TOKEN } })
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  const { phase, publishedAt, error, publishNow } = useRemotePublisher(state, {
    token: ready ? LIVE_OUTPUT_TOKEN : null,
    enabled,
    paused,
    label: state.name,
  });

  const url = projectorUrl();
  const cast = useCast(url);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 132,
      margin: 1,
      color: { dark: "#e2e8f0", light: "#00000000" },
    }).catch(() => undefined);
  }, [url]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => { setRemoteEnabled(!prev); return !prev; });
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((prev) => { setRemotePaused(!prev); return !prev; });
  }, []);

  const syncPlaylist = useCallback(async () => {
    if (!ready || !enabled || state.outputMode !== "playlist" || syncing) return;
    if (!window.confirm("Sync the current playlist to Live Output? Playback on the output endpoint will restart from the first playlist item.")) return;
    setSyncing(true);
    try { await publishNow(); } finally { setSyncing(false); }
  }, [enabled, publishNow, ready, state.outputMode, syncing]);

  const secondsAgo = publishedAt ? Math.round((Date.now() - publishedAt) / 1000) : null;

  return (
    <section className="space-y-3 border-b border-border p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground">Live output</h2>
        <button type="button" onClick={toggleEnabled} className={`flex items-center gap-1 rounded-md border px-2 py-1 ${enabled ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
          {enabled ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      <p className="text-muted-foreground">
        Permanent address for kiosk displays — point the screen at it once. It keeps showing the last published scene after a reload or with this studio closed.
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input readOnly value={url} className="min-w-0 flex-1 rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground" />
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
            <Copy className="size-3" /> {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <canvas ref={canvasRef} className="rounded bg-background/40" />
          <div className="flex flex-1 flex-col gap-2">
            <button type="button" onClick={togglePaused} className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
              {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
              {paused ? "Resume output" : "Pause output"}
            </button>
            <button type="button" onClick={() => void syncPlaylist()} disabled={!ready || !enabled || state.outputMode !== "playlist" || syncing} title={state.outputMode !== "playlist" ? "Select Playlist as the Output Mode to sync the playlist." : "Replace the cached Live Output playlist with the current Studio playlist."} className="flex items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-primary disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing playlist…" : "Sync Playlist"}
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-1 text-center text-muted-foreground">Open output</a>
            {cast.state !== "unsupported" ? (
              <button type="button" onClick={() => (cast.state === "casting" ? cast.stopCast() : void cast.startCast())} disabled={cast.state === "connecting" || cast.state === "unavailable"} className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50 ${cast.state === "casting" ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                <Cast className="size-3" />
                {cast.state === "casting" ? "Stop casting" : cast.state === "connecting" ? "Connecting…" : cast.state === "unavailable" ? "No Cast device" : "Cast to TV"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p className={error ? "text-destructive" : "text-muted-foreground"}>
        {error ? error : !enabled ? "Live output disabled." : paused ? "Paused — the display shows a paused notice." : phase === "uploading" ? "Uploading media…" : phase === "publishing" ? "Publishing scene…" : secondsAgo !== null ? `Published ${secondsAgo}s ago` : "Waiting to publish…"}
      </p>

      {cast.error ? <p className="text-destructive">{cast.error}</p> : cast.state === "casting" ? <p className="text-primary">Casting full screen to your TV.</p> : cast.state === "unsupported" ? <p className="text-muted-foreground">Casting needs Chrome or Edge on desktop or Android.</p> : null}
    </section>
  );
}
