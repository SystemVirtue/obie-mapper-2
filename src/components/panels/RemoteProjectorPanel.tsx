import { useCallback, useEffect, useRef, useState } from "react";
import { Cast, Copy, Pause, Play, RefreshCw, Wifi, WifiOff } from "lucide-react";
import QRCode from "qrcode";

import { createProjectorChannel } from "@/lib/projector.functions";
import {
  getRemoteEnabled,
  getRemotePaused,
  getStoredToken,
  projectorUrl,
  setRemoteEnabled,
  setRemotePaused,
  setStoredToken,
} from "@/lib/projector-link";
import type { ProjectState } from "@/lib/projection-types";
import { useRemotePublisher } from "@/lib/use-remote-publisher";
import { useCast } from "@/lib/use-cast";


interface Props {
  state: ProjectState;
}

export default function RemoteProjectorPanel({ state }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const provisioning = useRef(false);

  // The output endpoint must exist independently of this UI, so provision a
  // code and switch remote publishing on the first time the studio loads.
  useEffect(() => {
    const stored = getStoredToken();
    setToken(stored);
    setPaused(getRemotePaused());
    if (stored) {
      setEnabled(getRemoteEnabled());
      return;
    }
    if (provisioning.current) return;
    provisioning.current = true;
    setBusy(true);
    void createProjectorChannel()
      .then(({ token: fresh }) => {
        setStoredToken(fresh);
        setRemoteEnabled(true);
        setToken(fresh);
        setEnabled(true);
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }, []);

  const { phase, publishedAt, error } = useRemotePublisher(state, {
    token,
    enabled,
    paused,
    label: state.name,
  });

  const url = token ? projectorUrl(token) : "";

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 132,
      margin: 1,
      color: { dark: "#e2e8f0", light: "#00000000" },
    }).catch(() => undefined);
  }, [url]);

  const ensureToken = useCallback(async () => {
    const existing = getStoredToken();
    if (existing) return existing;
    setBusy(true);
    try {
      const { token: fresh } = await createProjectorChannel();
      setStoredToken(fresh);
      setToken(fresh);
      return fresh;
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleEnabled = useCallback(async () => {
    const next = !enabled;
    if (next) await ensureToken();
    setRemoteEnabled(next);
    setEnabled(next);
  }, [enabled, ensureToken]);

  const regenerate = useCallback(async () => {
    setBusy(true);
    try {
      const { token: fresh } = await createProjectorChannel();
      setStoredToken(fresh);
      setToken(fresh);
    } finally {
      setBusy(false);
    }
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((prev) => {
      setRemotePaused(!prev);
      return !prev;
    });
  }, []);

  const secondsAgo = publishedAt ? Math.round((Date.now() - publishedAt) / 1000) : null;

  return (
    <section className="space-y-3 border-b border-border p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground">Remote projector</h2>
        <button
          type="button"
          onClick={() => void toggleEnabled()}
          disabled={busy}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 ${
            enabled
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          {enabled ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      <p className="text-muted-foreground">
        Opens the mapped output on any device — the remote screen keeps showing the last published
        scene even after a reload or with this studio closed.
      </p>

      {token ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-muted-foreground">Projector code</span>
            <input
              value={token}
              onChange={(e) => {
                const next = e.target.value.trim();
                setToken(next);
                setStoredToken(next || null);
              }}
              spellCheck={false}
              className="w-full rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-primary"
            />
          </label>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              className="min-w-0 flex-1 rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground"
            >
              <Copy className="size-3" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <canvas ref={canvasRef} className="rounded bg-background/40" />
            <div className="flex flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={togglePaused}
                className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground"
              >
                {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
                {paused ? "Resume output" : "Pause output"}
              </button>
              <button
                type="button"
                onClick={() => void regenerate()}
                disabled={busy}
                className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground disabled:opacity-50"
              >
                <RefreshCw className="size-3" /> Regenerate code
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border px-2 py-1 text-center text-muted-foreground"
              >
                Open output
              </a>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void ensureToken()}
          disabled={busy}
          className="w-full rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create projector code"}
        </button>
      )}

      <p className={error ? "text-destructive" : "text-muted-foreground"}>
        {error
          ? error
          : !enabled
            ? "Remote output disabled."
            : paused
              ? "Paused — remote shows a paused notice."
              : phase === "uploading"
                ? "Uploading media…"
                : phase === "publishing"
                  ? "Publishing scene…"
                  : secondsAgo !== null
                    ? `Published ${secondsAgo}s ago`
                    : "Waiting to publish…"}
      </p>
    </section>
  );
}
