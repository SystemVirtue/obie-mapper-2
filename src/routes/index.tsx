import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

import InspectorPanel from "@/components/panels/InspectorPanel";
import StudioHeader from "@/components/panels/StudioHeader";
import ToolPanel from "@/components/panels/ToolPanel";
import { useEditorBroadcast } from "@/lib/projection-channel";
import {
  createDefaultState,
  createNode,
  newAssetId,
  type MediaAsset,
  type NodeKind,
  type ProjectionNode,
  type ProjectState,
} from "@/lib/projection-types";

const EditorStage = lazy(() => import("@/components/EditorStage"));
const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const TITLE = "Side-Projection Mapping Suite — Off-Axis Wall Mapping Studio";
const DESCRIPTION =
  "Draw projection windows on a wall photo, map video and image layers, and warp the output with homography correction for extreme side-throw projection.";

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
  const [state, setState] = useState<ProjectState>(() => createDefaultState());
  const [splitView, setSplitView] = useState(false);

  const patch = useCallback((partial: Partial<ProjectState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const { supported } = useEditorBroadcast(state, patch);

  const updateNode = useCallback((id: string, nodePatch: Partial<ProjectionNode>) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...nodePatch } : n)),
    }));
  }, []);

  const addNode = useCallback((kind: NodeKind) => {
    setState((prev) => {
      const node = createNode(kind, prev.nodes.length);
      return { ...prev, nodes: [...prev.nodes, node], selectedId: node.id };
    });
  }, []);

  const deleteNode = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== id),
      selectedId: prev.selectedId === id ? null : prev.selectedId,
    }));
  }, []);

  const reorder = useCallback((id: string, direction: -1 | 1) => {
    setState((prev) => {
      const index = prev.nodes.findIndex((n) => n.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.nodes.length) return prev;
      const nodes = [...prev.nodes];
      const moved = nodes[index]!;
      nodes[index] = nodes[target]!;
      nodes[target] = moved;
      return { ...prev, nodes };
    });
  }, []);

  const addAsset = useCallback((asset: Omit<MediaAsset, "id">) => {
    setState((prev) => ({ ...prev, assets: [...prev.assets, { ...asset, id: newAssetId() }] }));
  }, []);

  const launchProjector = useCallback(() => {
    const win = window.open(
      "/projector",
      "projector-output",
      "width=1280,height=720,menubar=no,toolbar=no",
    );
    if (!win) setSplitView(true);
  }, []);

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
        <ToolPanel
          state={state}
          onAddNode={addNode}
          onSelect={(id) => patch({ selectedId: id })}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          onReorder={reorder}
          onSetBackground={(url) =>
            setState((prev) => ({ ...prev, background: { ...prev.background, url } }))
          }
          onPatchBackground={(bgPatch) =>
            setState((prev) => ({ ...prev, background: { ...prev.background, ...bgPatch } }))
          }
          onAddAsset={addAsset}
        />

        <main className="flex min-w-0 flex-1 flex-col">
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
