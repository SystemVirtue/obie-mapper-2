import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";

import { getProjectorScene, type ProjectorStatus } from "@/lib/projector.functions";
import { createDefaultState, type ProjectState } from "@/lib/projection-types";

const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const TITLE = "Remote Projector Output — Side-Projection Mapping Suite";
const DESCRIPTION =
  "Dedicated fullscreen projector endpoint that mirrors the mapped output of a studio session on any device via a private projector code.";

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RemoteProjectorPage,
});

const MESSAGES: Record<Exclude<ProjectorStatus, "live" | "unchanged">, string> = {
  unknown: "Unknown projector code — open Remote Projector in the studio to copy the link.",
  waiting: "Waiting for the first scene from the studio…",
  stale: "Studio offline — showing the last published scene.",
  paused: "Output paused from the studio.",
  disabled: "Remote projector is switched off in the studio.",
};

function RemoteProjectorPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectState | null>(null);
  const [status, setStatus] = useState<ProjectorStatus | "offline">("waiting");
  const [showBadge, setShowBadge] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(0);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }, []);

  // Poll the published snapshot; `sinceRevision` keeps unchanged replies tiny.
  useEffect(() => {
    let cancelled = false;
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

  // Keep the badge out of the projection once everything is healthy.
  useEffect(() => {
    if (status !== "live" && status !== "unchanged") {
      setShowBadge(true);
      return;
    }
    const id = window.setTimeout(() => setShowBadge(false), 4000);
    return () => window.clearTimeout(id);
  }, [status]);

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
          <p className="font-mono text-[11px] text-muted-foreground">code: {token}</p>
          {status === "unknown" ? (
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
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-border bg-card/80 px-3 py-1.5 text-[11px] text-foreground backdrop-blur"
        >
          <Maximize2 className="size-3" /> Fullscreen (F)
        </button>
      ) : null}
    </div>
  );
}
