import { DEFAULT_CORNERS, type CornerPin, type ProjectState } from "@/lib/projection-types";

interface Props {
  state: ProjectState;
  onPatch: (patch: Partial<ProjectState>) => void;
}

const LABELS = ["TL", "TR", "BR", "BL"];

const inputClass =
  "w-full rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary";

/**
 * Absolute corner-pin coordinates in output pixels. Values are intentionally
 * unbounded so pins can sit outside the visible output area (rendering a layer
 * onto a canvas larger than the screen).
 */
export default function CornerPinPanel({ state, onPatch }: Props) {
  const corners: CornerPin[] =
    state.corners?.length === 4 ? state.corners : DEFAULT_CORNERS.map((c) => ({ ...c }));

  const setCorner = (index: number, axis: "x" | "y", pixels: number) => {
    if (!Number.isFinite(pixels)) return;
    const span = axis === "x" ? state.outputWidth || 1 : state.outputHeight || 1;
    const next = corners.map((c, i) => (i === index ? { ...c, [axis]: pixels / span } : { ...c }));
    onPatch({ corners: next });
  };

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Corner pins (output px)
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Edit here or drag the handles on the output. Values may go negative or beyond the output size
        to push a corner off screen.
      </p>

      <div className="space-y-2">
        {corners.map((corner, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-7 shrink-0 font-mono text-[11px] text-primary">
              {LABELS[index]}
            </span>
            <input
              type="number"
              step={1}
              className={inputClass}
              value={Math.round(corner.x * (state.outputWidth || 1))}
              onChange={(e) => setCorner(index, "x", Number(e.target.value))}
              aria-label={`${LABELS[index]} X in output pixels`}
            />
            <input
              type="number"
              step={1}
              className={inputClass}
              value={Math.round(corner.y * (state.outputHeight || 1))}
              onChange={(e) => setCorner(index, "y", Number(e.target.value))}
              aria-label={`${LABELS[index]} Y in output pixels`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPatch({ corners: DEFAULT_CORNERS.map((c) => ({ ...c })) })}
        className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Reset corner pins
      </button>
    </section>
  );
}
