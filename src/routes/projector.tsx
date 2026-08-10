import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

import { useProjectorMirror } from "@/lib/projection-channel";

const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const TITLE = "Projector Output — Side-Projection Mapping Suite";
const DESCRIPTION =
  "Perspective-corrected projector output window with 4-corner pinning and horizontal brightness gain for off-axis wall projection.";

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-foreground">
      <ClientOnly fallback={<div className="h-full w-full bg-black" />}>
        <Suspense fallback={<div className="h-full w-full bg-black" />}>
          <ProjectorViewport
            state={state}
            showHandles={showControls}
            onCornersChange={(corners) => pushCorners(corners, state.gainLeft, state.gainRight)}
          />
        </Suspense>
      </ClientOnly>

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          className="rounded-md border border-border bg-card/80 px-3 py-1.5 text-[11px] text-foreground backdrop-blur"
        >
          {showControls ? "Hide controls (show-ready)" : "Show controls"}
        </button>

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
                  pushCorners(state.corners, Number(e.target.value) / 100, state.gainRight)
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
                  pushCorners(state.corners, state.gainLeft, Number(e.target.value) / 100)
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
