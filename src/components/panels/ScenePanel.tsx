import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  FilePlus2,
  FolderOpen,
  Save,
  Trash2,
  Upload,
  Copy,
} from "lucide-react";

import {
  deleteProject,
  duplicateProject,
  exportProjectFile,
  importProjectFile,
  listProjects,
  loadProject,
  newProjectId,
  saveProject,
  type ProjectSummary,
} from "@/lib/project-store";
import type { ProjectState } from "@/lib/projection-types";

interface Props {
  state: ProjectState;
  projectId: string;
  onProjectIdChange: (id: string) => void;
  onRename: (name: string) => void;
  onLoadState: (state: ProjectState) => void;
  onNewScene: () => void;
}

const btn =
  "flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1.5 text-[11px] text-foreground transition-colors hover:border-primary";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function ScenePanel({
  state,
  projectId,
  onProjectIdChange,
  onRename,
  onLoadState,
  onNewScene,
}: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const idRef = useRef(projectId);
  idRef.current = projectId;

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setStatus("Local storage unavailable in this browser");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (asNew = false) => {
      setBusy(true);
      try {
        const id = asNew ? newProjectId() : idRef.current;
        await saveProject(id, stateRef.current.name || "Untitled scene", stateRef.current);
        if (asNew) onProjectIdChange(id);
        setStatus(`Saved ${new Date().toLocaleTimeString()}`);
        await refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [onProjectIdChange, refresh],
  );

  // Auto-save every 30s, and expose Cmd/Ctrl+S.
  useEffect(() => {
    const interval = window.setInterval(() => {
      void save(false);
    }, 30000);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("keydown", onKey);
    };
  }, [save]);

  const recall = async (id: string) => {
    setBusy(true);
    try {
      const loaded = await loadProject(id);
      if (loaded) {
        onProjectIdChange(id);
        onLoadState(loaded);
        setStatus(`Recalled “${loaded.name}”`);
      }
    } finally {
      setBusy(false);
    }
  };

  const exportScene = async () => {
    const json = await exportProjectFile(state.name || "Untitled scene", stateRef.current);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(state.name || "scene").replace(/\s+/g, "-").toLowerCase()}.mapscene.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-2 border-b border-border p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Scene
      </h2>
      <input
        className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        value={state.name}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Scene name"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => void save(false)}>
          <Save className="size-3.5 text-primary" /> Save
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => void save(true)}>
          <Copy className="size-3.5 text-primary" /> Save as new
        </button>
        <button type="button" className={btn} onClick={onNewScene}>
          <FilePlus2 className="size-3.5 text-primary" /> New
        </button>
        <button type="button" className={btn} onClick={() => void exportScene()}>
          <Download className="size-3.5 text-primary" /> Export
        </button>
        <button type="button" className={`${btn} col-span-2`} onClick={() => importRef.current?.click()}>
          <Upload className="size-3.5 text-primary" /> Import scene file
        </button>
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const { state: imported } = await importProjectFile(await file.text());
            const id = newProjectId();
            onProjectIdChange(id);
            onLoadState(imported);
            await saveProject(id, imported.name, imported);
            await refresh();
            setStatus(`Imported “${imported.name}”`);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Import failed");
          }
        }}
      />

      <p className="text-[10px] text-muted-foreground">
        {status || "Auto-saves locally every 30s · ⌘S to save now"}
      </p>

      <div className="space-y-1 pt-1">
        <h3 className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          <FolderOpen className="size-3" /> Saved scenes
        </h3>
        {projects.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nothing saved yet.</p>
        ) : null}
        <ul className="space-y-1">
          {projects.map((project) => (
            <li
              key={project.id}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${
                project.id === projectId
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => void recall(project.id)}
                title={`${project.nodeCount} nodes · ${project.assetCount} assets`}
              >
                {project.name}
                <span className="ml-1 opacity-60">{timeAgo(project.updatedAt)}</span>
              </button>
              <button
                type="button"
                title="Duplicate scene"
                onClick={async () => {
                  await duplicateProject(project.id);
                  await refresh();
                }}
              >
                <Copy className="size-3" />
              </button>
              <button
                type="button"
                title="Delete scene"
                onClick={async () => {
                  await deleteProject(project.id);
                  await refresh();
                }}
              >
                <Trash2 className="size-3 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
