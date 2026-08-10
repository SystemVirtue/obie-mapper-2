import type { ProjectionNode, ProjectState } from "@/lib/projection-types";

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

      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
        <button
          type="button"
          onClick={() => onPatch({ showGrid: !state.showGrid })}
          className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {state.showGrid ? "Hide stage grid" : "Show stage grid"}
        </button>
      </section>
    </aside>
  );
}
