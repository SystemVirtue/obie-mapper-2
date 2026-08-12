import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";

import OutputRecorder from "@/components/OutputRecorder";
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

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 rounded-md border border-border bg-card/80 px-3 py-1.5 text-[11px] text-foreground backdrop-blur"
          >
            <Maximize2 className="size-3" /> Fullscreen (F)
          </button>
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            className="rounded-md border border-border bg-card/80 px-3 py-1.5 text-[11px] text-foreground backdrop-blur"
          >
            {showControls ? "Hide controls (H)" : "Show controls"}
          </button>
        </div>

        {showControls ? (
          <div className="w-56 space-y-3 rounded-md border border-border bg-card/85 p-3 text-[11px] backdrop-blur">
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
            <p className="text-muted-foreground">
              Drag the TL / TR / BR / BL handles onto the physical wall bounds.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
