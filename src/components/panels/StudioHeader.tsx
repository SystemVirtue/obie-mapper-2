import { Lock, MonitorPlay, Ruler, SplitSquareHorizontal } from "lucide-react";

import type { ProjectState } from "@/lib/projection-types";

interface Props {
  state: ProjectState;
  onPatch: (patch: Partial<ProjectState>) => void;
  onLaunch: () => void;
  splitView: boolean;
  onToggleSplit: () => void;
  channelSupported: boolean;
  autoStart: boolean;
  onToggleAutoStart: () => void;
  onLock: () => void;
}

const numberClass =
  "w-16 rounded-md border border-border bg-background/60 px-2 py-1 text-xs text-foreground outline-none focus:border-primary";

export default function StudioHeader({
  state,
  onPatch,
  onLaunch,
  splitView,
  onToggleSplit,
  channelSupported,
  autoStart,
  onToggleAutoStart,
}: Props) {
  const setResolution = (width: number, height: number) => {
    onPatch({
      outputWidth: width,
      outputHeight: height,
      stageWidth: width,
      stageHeight: height,
    });
  };

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card/80 px-4 py-3">
      <div>
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Side-Projection Mapping Suite
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Off-axis wall mapping · 2m–8m throw · homography warp
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
        <Ruler className="size-3.5 text-primary" />
        <span className="text-[11px] text-muted-foreground">Wall (m)</span>
        <input
          type="number"
          step={0.1}
          min={0.5}
          className={numberClass}
          value={state.wallWidthM}
          onChange={(e) => onPatch({ wallWidthM: Number(e.target.value) })}
        />
        <span className="text-muted-foreground">×</span>
        <input
          type="number"
          step={0.1}
          min={0.5}
          className={numberClass}
          value={state.wallHeightM}
          onChange={(e) => onPatch({ wallHeightM: Number(e.target.value) })}
        />
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">Output</span>
        <input
          type="number"
          step={2}
          min={320}
          className={numberClass}
          value={state.outputWidth}
          onChange={(e) => setResolution(Number(e.target.value), state.outputHeight)}
        />
        <span className="text-muted-foreground">×</span>
        <input
          type="number"
          step={2}
          min={240}
          className={numberClass}
          value={state.outputHeight}
          onChange={(e) => setResolution(state.outputWidth, Number(e.target.value))}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] text-muted-foreground"
          title="On load, open the output window and fullscreen it on a secondary display when one is connected"
        >
          <input
            type="checkbox"
            checked={autoStart}
            onChange={onToggleAutoStart}
            className="size-3 accent-primary"
          />
          Auto-start output fullscreen
        </label>

        <button
          type="button"
          onClick={onToggleSplit}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <SplitSquareHorizontal className="size-4" />
          {splitView ? "Hide inline output" : "Split-screen output"}
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={!channelSupported}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          title={channelSupported ? "Open the projector output window" : "Multi-window sync unavailable — use split-screen"}
        >
          <MonitorPlay className="size-4" />
          Launch projector window
        </button>
      </div>
    </header>
  );
}
