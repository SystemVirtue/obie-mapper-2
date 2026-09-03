import CornerPinPanel from "@/components/panels/CornerPinPanel";
import {
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
  polygonPoints,
  type ProjectionNode,
  type ProjectState,
} from "@/lib/projection-types";


interface Props {
  state: ProjectState;
  onUpdateNode: (id: string, patch: Partial<ProjectionNode>) => void;
  onPatch: (patch: Partial<ProjectState>) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

export default function InspectorPanel({ state, onUpdateNode, onPatch }: Props) {
  const node = state.nodes.find((n) => n.id === state.selectedId) ?? null;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card/60 p-4">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Node inspector
        </h2>
        {!node ? (
          <p className="text-xs text-muted-foreground">Select a node on the stage.</p>
        ) : (
          <div className="space-y-3">
            <Row label="Name">
              <input
                className={inputClass}
                value={node.name}
                onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <Row label="X">
                <input
                  type="number"
                  className={inputClass}
                  value={Math.round(node.x)}
                  onChange={(e) => onUpdateNode(node.id, { x: Number(e.target.value) })}
                />
              </Row>
              <Row label="Y">
                <input
                  type="number"
                  className={inputClass}
                  value={Math.round(node.y)}
                  onChange={(e) => onUpdateNode(node.id, { y: Number(e.target.value) })}
                />
              </Row>
              <Row label="Width">
                <input
                  type="number"
                  className={inputClass}
                  value={Math.round(node.width)}
                  onChange={(e) => onUpdateNode(node.id, { width: Number(e.target.value) })}
                />
              </Row>
              <Row label="Height">
                <input
                  type="number"
                  className={inputClass}
                  value={Math.round(node.height)}
                  onChange={(e) => onUpdateNode(node.id, { height: Number(e.target.value) })}
                />
              </Row>
            </div>
            <Row label={`Rotation ${Math.round(node.rotation)}\u00B0`}>
              <input
                type="range"
                min={-180}
                max={180}
                value={Math.round(node.rotation)}
                onChange={(e) => onUpdateNode(node.id, { rotation: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </Row>

            {node.kind === "polygon" ? (
              <Row label={`Points ${node.sides ?? 4}`}>
                <input
                  type="range"
                  min={MIN_POLYGON_SIDES}
                  max={MAX_POLYGON_SIDES}
                  step={1}
                  value={node.sides ?? 4}
                  onChange={(e) => {
                    const sides = Number(e.target.value);
                    onUpdateNode(node.id, {
                      sides,
                      points: polygonPoints(sides, node.width, node.height),
                    });
                  }}
                  className="w-full accent-primary"
                />
              </Row>
            ) : null}

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <label className="flex items-center justify-between text-xs text-foreground">
                Smooth edges (spline)
                <input
                  type="checkbox"
                  checked={(node.tension ?? 0) > 0.02}
                  onChange={(e) => onUpdateNode(node.id, { tension: e.target.checked ? 0.5 : 0 })}
                  className="accent-primary"
                />
              </label>
              <Row label={`Curve amount ${Math.round((node.tension ?? 0) * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((node.tension ?? 0) * 100)}
                  onChange={(e) => onUpdateNode(node.id, { tension: Number(e.target.value) / 100 })}
                  className="w-full accent-primary"
                />
              </Row>
              <Row label={`Corner radius ${Math.round(node.cornerRadius ?? 0)}px`}>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(node.cornerRadius ?? 0)}
                  onChange={(e) => onUpdateNode(node.id, { cornerRadius: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </Row>
            </div>

            <Row label="Media source">
              <select
                className={inputClass}
                value={node.media === "color" ? "color" : (node.assetId ?? "color")}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "color") {
                    onUpdateNode(node.id, { media: "color", assetId: null });
                    return;
                  }
                  const asset = state.assets.find((a) => a.id === value);
                  if (asset) onUpdateNode(node.id, { media: asset.kind, assetId: asset.id });
                }}
              >
                <option value="color">Color fill</option>
                {state.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.kind === "video" ? "Video" : "Image"} — {asset.name}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="Color">
              <input
                type="color"
                value={node.color}
                onChange={(e) => onUpdateNode(node.id, { color: e.target.value })}
                className="h-8 w-full cursor-pointer rounded border border-border bg-background/60"
              />
            </Row>

            <Row label={`Opacity ${Math.round(node.opacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(node.opacity * 100)}
                onChange={(e) => onUpdateNode(node.id, { opacity: Number(e.target.value) / 100 })}
                className="w-full accent-primary"
              />
            </Row>

            <div className="space-y-2 rounded-md border border-border/70 p-3">
              <label className="flex items-center justify-between text-xs text-foreground">
                Glow / bloom
                <input
                  type="checkbox"
                  checked={node.glow}
                  onChange={(e) => onUpdateNode(node.id, { glow: e.target.checked })}
                  className="accent-primary"
                />
              </label>
              <Row label={`Intensity ${Math.round(node.glowIntensity * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(node.glowIntensity * 100)}
                  onChange={(e) =>
                    onUpdateNode(node.id, { glowIntensity: Number(e.target.value) / 100 })
                  }
                  className="w-full accent-primary"
                />
              </Row>
            </div>

            <Row label="Trigger every (seconds, 0 = off)">
              <input
                type="number"
                min={0}
                step={0.5}
                className={inputClass}
                value={node.triggerSeconds}
                onChange={(e) => onUpdateNode(node.id, { triggerSeconds: Number(e.target.value) })}
              />
            </Row>
          </div>
        )}
      </section>

      <CornerPinPanel state={state} onPatch={onPatch} />

      <section className="space-y-3 border-t border-border pt-4">

          Falloff compensation
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Boost the far end of the throw and dim the near end.
        </p>
        <Row label={`Near side gain ${state.gainLeft.toFixed(2)}x`}>
          <input
            type="range"
            min={10}
            max={200}
            value={Math.round(state.gainLeft * 100)}
            onChange={(e) => onPatch({ gainLeft: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
        </Row>
        <Row label={`Far side gain ${state.gainRight.toFixed(2)}x`}>
          <input
            type="range"
            min={10}
            max={200}
            value={Math.round(state.gainRight * 100)}
            onChange={(e) => onPatch({ gainRight: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
        </Row>
        <Row label={`Global brightness ${Math.round(state.brightness * 100)}%`}>
          <input
            type="range"
            min={0}
            max={200}
            value={Math.round(state.brightness * 100)}
            onChange={(e) => onPatch({ brightness: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
        </Row>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => onPatch({ showGrid: !state.showGrid })}
            className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {state.showGrid ? "Hide stage grid" : "Show stage grid"}
          </button>
          <button
            type="button"
            onClick={() => onPatch({ xray: !state.xray })}
            className={`w-full rounded-md border px-2 py-1.5 text-xs ${
              state.xray
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            X-ray outlines (X)
          </button>
          <button
            type="button"
            onClick={() => onPatch({ testPattern: !state.testPattern })}
            className={`w-full rounded-md border px-2 py-1.5 text-xs ${
              state.testPattern
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Calibration test pattern
          </button>
        </div>
      </section>

    </aside>
  );
}
