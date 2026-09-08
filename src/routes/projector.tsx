import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Cast, Maximize2 } from "lucide-react";

import ControlDock from "@/components/ControlDock";
import OutputRecorder from "@/components/OutputRecorder";
import { useCast } from "@/lib/use-cast";
import { useProjectorMirror } from "@/lib/projection-channel";


const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const TITLE = "Projector Output — Side-Projection Mapping Suite";
const DESCRIPTION =
  "Perspective-corrected projector output window with 4-corner pinning, global brightness and horizontal gain for off-axis wall projection.";

export const Route = createFileRoute("/projector")({
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
  component: ProjectorPage,
});

function ProjectorPage() {
  const { state, connected, pushCorners } = useProjectorMirror();
  const [showControls, setShowControls] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cast = useCast(typeof window === "undefined" ? "" : window.location.href);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }, []);

  // Auto-fullscreen when launched with ?fullscreen=1 (secondary display startup).
  const [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("fullscreen")) return;
    const el = shellRef.current;
    if (!el) return;
    el.requestFullscreen?.()
      .then(() => setShowControls(false))
      .catch(() => setNeedsGesture(true));
  }, []);

  // Auto-hide the controls after 5s of inactivity; any click/move brings them back.
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowControls(false), 5000);
    };
    const wake = () => {
      setShowControls(true);
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
      if (e.key.toLowerCase() === "h") setShowControls((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);


  return (
    <div ref={shellRef} className="relative h-screen w-screen overflow-hidden bg-black text-foreground">
      <ClientOnly fallback={<div className="h-full w-full bg-black" />}>
        <Suspense fallback={<div className="h-full w-full bg-black" />}>
          <ProjectorViewport
            state={state}
            showHandles={showControls}
            onCanvasReady={(canvas) => {
              canvasRef.current = canvas;
            }}
            onCornersChange={(corners) =>
              pushCorners(corners, state.gainLeft, state.gainRight, state.brightness)
            }
          />
        </Suspense>
      </ClientOnly>

      {needsGesture ? (
        <button
          type="button"
          onClick={() => {
            setNeedsGesture(false);
            toggleFullscreen();
          }}
          className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-md bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground"
        >
          Click to go fullscreen on this display
        </button>
      ) : null}

      {showControls ? (
        <ControlDock
          title="Output controls"
          storageKey="spm.dock.projector"
          defaultPosition={{
            x: typeof window === "undefined" ? 16 : Math.max(16, window.innerWidth - 250),
            y: 16,
          }}
          className="w-56"
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-foreground"
              >
                <Maximize2 className="size-3" /> Fullscreen (F)
              </button>
              <button
                type="button"
                onClick={() => setShowControls(false)}
                className="rounded-md border border-border px-2 py-1 text-muted-foreground"
              >
                Hide (H)
              </button>
            </div>
            <p className={connected ? "text-primary" : "text-muted-foreground"}>
              {connected ? "Synced with editor" : "Waiting for editor…"}
            </p>
            <label className="block space-y-1">
              <span className="text-muted-foreground">
                Near gain {state.gainLeft.toFixed(2)}x
              </span>
              <input
                type="range"
                min={10}
                max={200}
                value={Math.round(state.gainLeft * 100)}
                onChange={(e) =>
                  pushCorners(
                    state.corners,
                    Number(e.target.value) / 100,
                    state.gainRight,
                    state.brightness,
                  )
                }
                className="w-full accent-primary"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">Far gain {state.gainRight.toFixed(2)}x</span>
              <input
                type="range"
                min={10}
                max={200}
                value={Math.round(state.gainRight * 100)}
                onChange={(e) =>
                  pushCorners(
                    state.corners,
                    state.gainLeft,
                    Number(e.target.value) / 100,
                    state.brightness,
                  )
                }
                className="w-full accent-primary"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">
                Brightness {Math.round(state.brightness * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(state.brightness * 100)}
                onChange={(e) =>
                  pushCorners(
                    state.corners,
                    state.gainLeft,
                    state.gainRight,
                    Number(e.target.value) / 100,
                  )
                }
                className="w-full accent-primary"
              />
            </label>
            <OutputRecorder getCanvas={() => canvasRef.current} />
            <p className="text-muted-foreground">
              Drag this panel by its handle; drag TL / TR / BR / BL onto the wall bounds.
            </p>
          </div>
        </ControlDock>
      ) : null}

    </div>
  );
}
