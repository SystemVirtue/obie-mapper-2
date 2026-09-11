import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Cast, Maximize2 } from "lucide-react";

import ControlDock from "@/components/ControlDock";
import { getProjectorScene, type ProjectorStatus } from "@/lib/projector.functions";
import type { ProjectState } from "@/lib/projection-types";
import { useCast } from "@/lib/use-cast";

const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const MESSAGES: Record<Exclude<ProjectorStatus, "live" | "unchanged">, string> = {
  unknown: "No scene published yet — open the studio to start the output.",
  waiting: "Waiting for the first scene from the studio…",
  stale: "Studio offline — showing the last published scene.",
  paused: "Output paused from the studio.",
  disabled: "Remote projector is switched off in the studio.",
};

const FS_CONSENT_KEY = "spm.remoteAutoFullscreen";

interface Props {
  token: string;
  /** Show a "different code" escape hatch (legacy code-based endpoint only). */
  allowCodeEntry?: boolean;
}

export default function RemoteOutput({ token, allowCodeEntry = false }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectState | null>(null);
  const [status, setStatus] = useState<ProjectorStatus | "offline">("waiting");
  const [showBadge, setShowBadge] = useState(true);
  const [autoFullscreen, setAutoFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(0);
  const cast = useCast(typeof window === "undefined" ? "" : window.location.href);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }, []);

  // Remembered consent: auto-request fullscreen on load, and on the first tap
  // if the browser rejects the automatic request without a gesture.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const consented = localStorage.getItem(FS_CONSENT_KEY) === "1";
    setAutoFullscreen(consented);
    if (!consented) return;
    const el = shellRef.current;
    if (!el || document.fullscreenElement) return;
    const request = () => {
      void el.requestFullscreen?.().catch(() => undefined);
    };
    request();
    const once = () => {
      request();
      window.removeEventListener("pointerdown", once);
    };
    window.addEventListener("pointerdown", once);
    return () => window.removeEventListener("pointerdown", once);
  }, []);

  const enableAutoFullscreen = useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(FS_CONSENT_KEY, "1");
    setAutoFullscreen(true);
    toggleFullscreen();
  }, [toggleFullscreen]);

  const disableAutoFullscreen = useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(FS_CONSENT_KEY);
    setAutoFullscreen(false);
  }, []);

  // Poll the published snapshot; `sinceRevision` keeps unchanged replies tiny.
  useEffect(() => {
    let cancelled = false;
    revisionRef.current = 0;
    const tick = async () => {
      try {
        const snap = await getProjectorScene({
          data: { token, sinceRevision: revisionRef.current },
        });
        if (cancelled) return;
        setStatus(snap.status);
        if (snap.scene) {
          revisionRef.current = snap.revision;
          setState(snap.scene as unknown as ProjectState);
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  // Auto-hide the controls after 5s of inactivity; click/tap brings them back.
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowBadge(false), 5000);
    };
    const wake = () => {
      setShowBadge(true);
      arm();
    };
    arm();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const blank = status === "paused" || status === "disabled" || status === "unknown";
  const showScene = Boolean(state) && !blank;
  const message =
    status === "offline"
      ? "Reconnecting to the studio…"
      : status === "live" || status === "unchanged"
        ? null
        : MESSAGES[status];

  return (
    <div ref={shellRef} className="relative h-screen w-screen overflow-hidden bg-black">
      {showScene && state ? (
        <ClientOnly fallback={<div className="h-full w-full bg-black" />}>
          <Suspense fallback={<div className="h-full w-full bg-black" />}>
            <ProjectorViewport state={state} showHandles={false} />
          </Suspense>
        </ClientOnly>
      ) : (
        <div className="h-full w-full bg-black" />
      )}

      {message && (blank || !state) ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="max-w-md text-sm text-foreground">{message}</p>
          {allowCodeEntry ? (
            <p className="font-mono text-[11px] text-muted-foreground">code: {token}</p>
          ) : null}
          {allowCodeEntry && status === "unknown" ? (
            <button
              type="button"
              onClick={() => void navigate({ to: "/p" })}
              className="rounded-md border border-border px-3 py-1.5 text-[11px] text-foreground"
            >
              Enter a different code
            </button>
          ) : null}
        </div>
      ) : null}

      {message && !blank && state && showBadge ? (
        <div className="absolute bottom-3 left-3 z-20 rounded-md border border-border bg-card/85 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          {message}
        </div>
      ) : null}

      {showBadge ? (
        <ControlDock
          title="Output"
          storageKey="spm.dock.remote"
          defaultPosition={{
            x: typeof window === "undefined" ? 16 : Math.max(16, window.innerWidth - 220),
            y: 16,
          }}
          className="w-52"
        >
          <div className="space-y-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-foreground"
            >
              <Maximize2 className="size-3" /> Fullscreen (F)
            </button>
            <button
              type="button"
              onClick={autoFullscreen ? disableAutoFullscreen : enableAutoFullscreen}
              className={`w-full rounded-md border px-2 py-1 ${
                autoFullscreen
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {autoFullscreen ? "Auto-fullscreen ON" : "Always fullscreen on this device"}
            </button>
            {cast.state !== "unsupported" ? (
              <button
                type="button"
                onClick={() => (cast.state === "casting" ? cast.stopCast() : void cast.startCast())}
                disabled={cast.state === "connecting" || cast.state === "unavailable"}
                className={`flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50 ${
                  cast.state === "casting"
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Cast className="size-3" />
                {cast.state === "casting"
                  ? "Stop casting"
                  : cast.state === "connecting"
                    ? "Connecting…"
                    : cast.state === "unavailable"
                      ? "No Cast device"
                      : "Cast to TV"}
              </button>
            ) : null}
            <p className="text-muted-foreground">Controls hide after 5s — tap to show.</p>
          </div>
        </ControlDock>
      ) : null}
    </div>
  );
}
