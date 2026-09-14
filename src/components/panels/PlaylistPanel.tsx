import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ListPlus, Play, Trash2 } from "lucide-react";
import { listProjects, type ProjectSummary } from "@/lib/project-store";
import type { PlaylistItem, ProjectState } from "@/lib/projection-types";

interface Props { state: ProjectState; onPatch: (patch: Partial<ProjectState>) => void; }
const btn = "flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1.5 text-[11px] hover:border-primary disabled:opacity-40";

export default function PlaylistPanel({ state, onPatch }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const refresh = useCallback(async () => setProjects(await listProjects().catch(() => [])), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const add = () => {
    const project = projects.find((p) => p.id === selectedProject);
    if (!project || state.playlist.some((item) => item.projectId === project.id)) return;
    const item: PlaylistItem = { projectId: project.id, name: project.name, seconds: 10, fade: 1 };
    onPatch({ playlist: [...state.playlist, item], outputMode: "playlist" });
    setSelectedProject("");
  };
  const update = (index: number, patch: Partial<PlaylistItem>) => onPatch({ playlist: state.playlist.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const remove = (index: number) => onPatch({ playlist: state.playlist.filter((_, i) => i !== index) });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction; if (target < 0 || target >= state.playlist.length) return;
    const next = [...state.playlist]; [next[index], next[target]] = [next[target]!, next[index]!]; onPatch({ playlist: next });
  };

  return <section className="space-y-3 border-b border-border p-4">
    <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Playlist</h2><span className="text-[10px] text-muted-foreground">{state.playlist.length} scenes</span></div>
    <div className="space-y-2">
      <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
        <option value="">Select saved scene…</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button type="button" className={`${btn} w-full justify-center`} disabled={!selectedProject} onClick={add}><ListPlus className="size-3.5" /> Add scene</button>
    </div>
    {state.playlist.map((item, index) => <div key={`${item.projectId}-${index}`} className="rounded-md border border-border/70 p-2 space-y-2">
      <div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-[11px] font-medium">{index + 1}. {item.name}</span>
        <button type="button" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp className="size-3" /></button>
        <button type="button" title="Move down" disabled={index === state.playlist.length - 1} onClick={() => move(index, 1)}><ChevronDown className="size-3" /></button>
        <button type="button" title="Remove" onClick={() => remove(index)}><Trash2 className="size-3 text-destructive" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-muted-foreground">Seconds<input type="number" min="0.1" step="0.5" value={item.seconds} onChange={(e) => update(index, { seconds: Math.max(0.1, Number(e.target.value) || 0.1) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]" /></label><label className="text-[10px] text-muted-foreground">Fade<input type="number" min="0" step="0.1" value={item.fade} onChange={(e) => update(index, { fade: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px]" /></label></div>
    </div>)}
    <div className="grid grid-cols-2 gap-2"><button type="button" className={btn} onClick={() => onPatch({ outputMode: "playlist" })}><Play className="size-3.5" /> Playlist output</button><button type="button" className={btn} onClick={() => onPatch({ playlistLoop: !state.playlistLoop })}>{state.playlistLoop ? "Loop: On" : "Loop: Off"}</button></div>
  </section>;
}
