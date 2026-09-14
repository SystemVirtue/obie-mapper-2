import {
  Image as ImageIcon,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Lock,
  Music,
  Plus,
  Square,
  Trash2,
  Unlock,
  Upload,
  Video,
} from "lucide-react";
import { useRef } from "react";

import type { MediaAsset, NodeKind, ProjectionNode, ProjectState } from "@/lib/projection-types";
import BuiltinTestAssetsPanel from "./BuiltinTestAssetsPanel";

interface Props {
  state: ProjectState;
  onAddNode: (kind: NodeKind) => void;
  onSelect: (id: string) => void;
  onUpdateNode: (id: string, patch: Partial<ProjectionNode>) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onSetBackground: (url: string) => void;
  onPatchBackground: (patch: Partial<ProjectState["background"]>) => void;
  onAddAsset: (asset: Omit<MediaAsset, "id">) => void;
}

const toolButtons: { kind: NodeKind; label: string; icon: typeof Square }[] = [
  { kind: "rect", label: "Rect window", icon: Square },
  { kind: "polygon", label: "Polygon", icon: Layers },
  { kind: "particles", label: "Note field", icon: Music },
];

export default function ToolPanel({
  state,
  onAddNode,
  onSelect,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onReorder,
  onSetBackground,
  onPatchBackground,
  onAddAsset,
}: Props) {
  const wallInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="flex w-full flex-1 flex-col gap-5 bg-card/60 p-4">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Add node
        </h2>
        <div className="grid gap-2">
          {toolButtons.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => onAddNode(kind)}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-secondary"
            >
              <Icon className="size-4 text-primary" />
              {label}
              <Plus className="ml-auto size-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith("image/")) onSetBackground(URL.createObjectURL(file));
        }}
      >
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Wall reference
        </h2>
        <button
          type="button"
          onClick={() => wallInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-border bg-background/40 px-3 py-5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Upload className="size-4" />
          Drop wall photo or click
        </button>
        <input
          ref={wallInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSetBackground(URL.createObjectURL(file));
          }}
        />
        <div className="mt-3 space-y-2">
          <label className="flex items-center justify-between text-xs text-muted-foreground">
            Opacity
            <span className="text-foreground">{Math.round(state.background.opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(state.background.opacity * 100)}
            onChange={(e) => onPatchBackground({ opacity: Number(e.target.value) / 100 })}
            className="w-full accent-primary"
          />
          <button
            type="button"
            onClick={() => onPatchBackground({ visible: !state.background.visible })}
            className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {state.background.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {state.background.visible ? "Reference visible" : "Reference hidden"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Media assets
        </h2>
        <button
          type="button"
          onClick={() => mediaInputRef.current?.click()}
          className="mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-foreground hover:border-primary"
        >
          <Upload className="size-3.5 text-primary" /> Upload image / video
        </button>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            for (const file of Array.from(e.target.files ?? [])) {
              onAddAsset({
                name: file.name,
                kind: file.type.startsWith("video/") ? "video" : "image",
                url: URL.createObjectURL(file),
              });
            }
          }}
        />
        <BuiltinTestAssetsPanel onAddAsset={onAddAsset} />
        <ul className="mt-2 space-y-1">
          {state.assets.length === 0 ? (
            <li className="text-xs text-muted-foreground">No assets yet.</li>
          ) : null}
          {state.assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center gap-2 rounded border border-border/60 px-2 py-1 text-xs text-muted-foreground"
            >
              {asset.kind === "video" ? (
                <Video className="size-3.5 text-primary" />
              ) : (
                <ImageIcon className="size-3.5 text-primary" />
              )}
              <span className="truncate">{asset.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Layers
        </h2>
        <ul className="space-y-1">
          {state.nodes.length === 0 ? (
            <li className="text-xs text-muted-foreground">Add a projection node to begin.</li>
          ) : null}
          {[...state.nodes].reverse().map((node) => (
            <li
              key={node.id}
              className={`flex items-center gap-1 rounded border px-2 py-1.5 text-xs ${
                state.selectedId === node.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              <GripVertical className="size-3 shrink-0 opacity-50" />
              <button type="button" className="flex-1 truncate text-left" onClick={() => onSelect(node.id)}>
                {node.name}
              </button>
              <button type="button" onClick={() => onReorder(node.id, 1)} title="Bring forward">
                ↑
              </button>
              <button type="button" onClick={() => onReorder(node.id, -1)} title="Send backward">
                ↓
              </button>
              <button
                type="button"
                onClick={() => onUpdateNode(node.id, { locked: !node.locked })}
                title={node.locked ? "Unlock" : "Lock"}
              >
                {node.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>
              <button type="button" onClick={() => onDuplicateNode(node.id)} title="Duplicate">
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateNode(node.id, { visible: !node.visible })}
                title="Toggle visibility"
              >
                {node.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button type="button" onClick={() => onDeleteNode(node.id)} title="Delete">
                <Trash2 className="size-3.5 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
