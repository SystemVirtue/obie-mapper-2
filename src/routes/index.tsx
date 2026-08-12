import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Redo2, Undo2 } from "lucide-react";

import OutputRecorder from "@/components/OutputRecorder";
import InspectorPanel from "@/components/panels/InspectorPanel";
import ScenePanel from "@/components/panels/ScenePanel";
import StudioHeader from "@/components/panels/StudioHeader";
import ToolPanel from "@/components/panels/ToolPanel";
import { getAutoStart, openProjectorWindow, setAutoStart } from "@/lib/output-window";
import { newProjectId } from "@/lib/project-store";
import { useEditorBroadcast } from "@/lib/projection-channel";
import {
  createDefaultState,
  createNode,
  duplicateNode,
  newAssetId,
  type MediaAsset,
  type NodeKind,
  type ProjectionNode,
  type ProjectState,
} from "@/lib/projection-types";
import { useHistory } from "@/lib/use-history";

const EditorStage = lazy(() => import("@/components/EditorStage"));
const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const TITLE = "Side-Projection Mapping Suite — Off-Axis Wall Mapping Studio";
const DESCRIPTION =
  "Draw projection windows on a wall photo, map video and image layers, save and recall scenes, and warp the output with homography correction for extreme side-throw projection.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function StagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function EditorPage() {
  const { state, stateRef, commit, undo, redo, reset, canUndo, canRedo } =
    useHistory<ProjectState>(() => createDefaultState());
  const [splitView, setSplitView] = useState(false);
  const [projectId, setProjectId] = useState(() => newProjectId());
  const [autoStart, setAutoStartState] = useState(false);
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const patch = useCallback(
    (partial: Partial<ProjectState>) => {
      const historic = !("selectedId" in partial) || Object.keys(partial).length > 1;
      commit((prev) => ({ ...prev, ...partial }), historic);
    },
    [commit],
  );

  const { supported } = useEditorBroadcast(state, patch);

  const updateNode = useCallback(
    (id: string, nodePatch: Partial<ProjectionNode>) => {
      commit((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...nodePatch } : n)),
      }));
    },
    [commit],
  );

  const addNode = useCallback(
    (kind: NodeKind) => {
      commit((prev) => {
        const node = createNode(kind, prev.nodes.length);
        return { ...prev, nodes: [...prev.nodes, node], selectedId: node.id };
      });
    },
    [commit],
  );

  const deleteNode = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== id),
        selectedId: prev.selectedId === id ? null : prev.selectedId,
      }));
    },
    [commit],
  );

  const cloneNode = useCallback(
    (id: string) => {
      commit((prev) => {
        const source = prev.nodes.find((n) => n.id === id);
        if (!source) return prev;
        const copy = duplicateNode(source);
        return { ...prev, nodes: [...prev.nodes, copy], selectedId: copy.id };
      });
    },
    [commit],
  );

  const reorder = useCallback(
    (id: string, direction: -1 | 1) => {
      commit((prev) => {
        const index = prev.nodes.findIndex((n) => n.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= prev.nodes.length) return prev;
        const nodes = [...prev.nodes];
        const moved = nodes[index]!;
        nodes[index] = nodes[target]!;
        nodes[target] = moved;
        return { ...prev, nodes };
      });
    },
    [commit],
  );

  const addAsset = useCallback(
    (asset: Omit<MediaAsset, "id">) => {
      commit((prev) => ({ ...prev, assets: [...prev.assets, { ...asset, id: newAssetId() }] }));
    },
    [commit],
  );

  const launchProjector = useCallback(() => {
    const win = window.open(
      "/projector",
      "projector-output",
      "width=1280,height=720,menubar=no,toolbar=no",
    );
    if (!win) setSplitView(true);
  }, []);

  // Global keyboard shortcuts (⌘S is handled inside ScenePanel).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const selected = stateRef.current.selectedId;

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "d" && selected) {
        event.preventDefault();
        cloneNode(selected);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        deleteNode(selected);
        return;
      }
      if (!mod && key === "x") {
        event.preventDefault();
        patch({ xray: !stateRef.current.xray });
      }
      if (!mod && key === "g") {
        event.preventDefault();
        patch({ showGrid: !stateRef.current.showGrid });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cloneNode, deleteNode, patch, redo, stateRef, undo]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <StudioHeader
        state={state}
        onPatch={patch}
        onLaunch={launchProjector}
        splitView={splitView}
        onToggleSplit={() => setSplitView((v) => !v)}
        channelSupported={supported}
      />

      {!supported ? (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/15 px-4 py-2 text-[11px] text-foreground">
          <AlertTriangle className="size-3.5 text-destructive" />
          Multi-window sync is unavailable in this browser — the split-screen output below stays
          fully functional.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border">
          <ScenePanel
            state={state}
            projectId={projectId}
            onProjectIdChange={setProjectId}
            onRename={(name) => patch({ name })}
            onLoadState={(loaded) => reset(loaded)}
            onNewScene={() => {
              setProjectId(newProjectId());
              reset(createDefaultState());
            }}
          />
          <ToolPanel
            state={state}
            onAddNode={addNode}
            onSelect={(id) => patch({ selectedId: id })}
            onUpdateNode={updateNode}
            onDeleteNode={deleteNode}
            onDuplicateNode={cloneNode}
            onReorder={reorder}
            onSetBackground={(url) =>
              commit((prev) => ({ ...prev, background: { ...prev.background, url } }))
            }
            onPatchBackground={(bgPatch) =>
              commit((prev) => ({ ...prev, background: { ...prev.background, ...bgPatch } }))
            }
            onAddAsset={addAsset}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              <Undo2 className="size-3" /> Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              <Redo2 className="size-3" /> Redo
            </button>
            <span className="ml-auto">
              ⌘Z undo · ⌘⇧Z redo · ⌘D duplicate · ⌫ delete · X x-ray · G grid · ⌘S save
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <ClientOnly fallback={<StagePlaceholder label="Loading stage…" />}>
              <Suspense fallback={<StagePlaceholder label="Loading stage…" />}>
                <EditorStage
                  state={state}
                  onSelect={(id) => patch({ selectedId: id })}
                  onUpdateNode={updateNode}
                />
              </Suspense>
            </ClientOnly>
          </div>

          {splitView ? (
            <div className="h-2/5 min-h-[220px] border-t border-border">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>Projector viewport (inline)</span>
                <span>Drag TL/TR/BR/BL to corner-pin</span>
              </div>
              <div className="h-[calc(100%-30px)]">
                <ClientOnly fallback={<StagePlaceholder label="Loading output…" />}>
                  <Suspense fallback={<StagePlaceholder label="Loading output…" />}>
                    <ProjectorViewport
                      state={state}
                      showHandles
                      onCornersChange={(corners) => patch({ corners })}
                    />
                  </Suspense>
                </ClientOnly>
              </div>
            </div>
          ) : null}
        </main>

        <InspectorPanel state={state} onUpdateNode={updateNode} onPatch={patch} />
      </div>
    </div>
  );
}
