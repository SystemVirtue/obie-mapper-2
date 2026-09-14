import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Cast, Maximize2 } from "lucide-react";

import ControlDock from "@/components/ControlDock";
import { getProjectorScene, type ProjectorStatus } from "@/lib/projector.functions";
import type { PlaylistItem, ProjectState } from "@/lib/projection-types";
import { clearLivePlaylist, loadLivePlaylist, persistLivePlaylist } from "@/lib/live-playlist-store";
import { useCast } from "@/lib/use-cast";

const ProjectorViewport = lazy(() => import("@/components/ProjectorViewport"));

const MESSAGES: Record<Exclude<ProjectorStatus, "live" | "unchanged">, string> = {
  unknown: "No scene published yet — open the studio to start the output.",
  waiting: "Waiting for the first scene from the studio…",
  stale: "Studio offline — showing the last published scene.",
  paused: "Output paused from the studio.",
  disabled: "Remote projector is switched off in the studio.",
};

const FS_CONSENT_KEY = "spm.remoteAutoFullscreen";
const PLAYLIST_META = "__livePlaylist";

type PublishedPlaylist = {
  items: PlaylistItem[];
  loop: boolean;
  scenes: Record<string, ProjectState>;
};

function readPlaylist(scene: ProjectState | null): PublishedPlaylist | null {
  const value = (scene as (ProjectState & { [PLAYLIST_META]?: unknown }) | null)?.[PLAYLIST_META];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PublishedPlaylist>;
  if (!Array.isArray(candidate.items) || !candidate.scenes || typeof candidate.scenes !== "object") return null;
  return candidate as PublishedPlaylist;
}

interface Props {
  token: string;
  allowCodeEntry?: boolean;
}

export default function RemoteOutput({ token, allowCodeEntry = false }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<ProjectState | null>(null);
  const [status, setStatus] = useState<ProjectorStatus | "offline">("waiting");
  const [showBadge, setShowBadge] = useState(true);
  const [autoFullscreen, setAutoFullscreen] = useState(false);
  const [playlistReady, setPlaylistReady] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [playlistOpacity, setPlaylistOpacity] = useState(1);
  const shellRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(0);
  const outputModeRef = useRef<ProjectState["outputMode"] | null>(null);
  const playlistRef = useRef<PublishedPlaylist | null>(null);
  const playbackStartedRef = useRef(false);
  const playbackStartedAtRef = useRef(0);
  const cast = useCast(typeof window === "undefined" ? "" : window.location.href);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const consented = localStorage.getItem(FS_CONSENT_KEY) === "1";
    setAutoFullscreen(consented);
    if (!consented) return;
    const el = shellRef.current;
    if (!el || document.fullscreenElement) return;
    const request = () => void el.requestFullscreen?.().catch(() => undefined);
    request();
    const once = () => { request(); window.removeEventListener("pointerdown", once); };
    window.addEventListener("pointerdown", once);
    return () => window.removeEventListener("pointerdown", once);
  }, []);

  const enableAutoFullscreen = useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(FS_CONSENT_KEY, "1");
    setAutoFullscreen(true);
    toggleFullscreen();
  }, [toggleFullscreen]);

  const disableAutoFullscreen = useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(FS_CONSENT_KEY);
    setAutoFullscreen(false);
  }, []);

  // Restore the last accepted playlist before asking the server. The kiosk is
  // deliberately self-contained: a playlist keeps running through refreshes,
  // studio edits, and temporary network loss until outputMode changes.
  useEffect(() => {
    let cancelled = false;
    void loadLivePlaylist().then((scenes) => {
      if (cancelled || !scenes?.length) return;
      const first = scenes[0]!;
      const items = first.playlist ?? [];
      const byId = Object.fromEntries(scenes.map((scene) => [scene.name, scene]));
      const mapped: Record<string, ProjectState> = {};
      for (const item of items) {
        const scene = scenes.find((candidate) => candidate.name === item.name);
        if (scene) mapped[item.projectId] = scene;
      }
      const fallback = Object.keys(mapped).length ? mapped : byId;
      const playlist: PublishedPlaylist = { items, loop: first.playlistLoop, scenes: fallback };
      playlistRef.current = playlist;
      outputModeRef.current = "playlist";
      setState(first);
      setPlaylistReady(true);
      setPlaylistIndex(0);
      playbackStartedAtRef.current = performance.now();
      playbackStartedRef.current = true;
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Poll the published snapshot. In playlist mode, a playlist received from
  // the studio is accepted only once; subsequent revisions cannot interrupt
  // playback. A change away from playlist mode explicitly releases the local
  // snapshot and switches to the newly published output mode.
  useEffect(() => {
    let cancelled = false;
    revisionRef.current = 0;
    const tick = async () => {
      try {
        const snap = await getProjectorScene({ data: { token, sinceRevision: revisionRef.current } });
        if (cancelled) return;
        setStatus(snap.status);
        if (!snap.scene) return;
        revisionRef.current = snap.revision;
        const incoming = snap.scene as unknown as ProjectState;
        const incomingPlaylist = readPlaylist(incoming);
        const incomingMode = incoming.outputMode;

        if (incomingMode === "playlist" && incomingPlaylist?.items?.length) {
          if (outputModeRef.current !== "playlist" || !playlistRef.current) {
            const sceneList = incomingPlaylist.items
              .map((item) => incomingPlaylist.scenes[item.projectId])
              .filter(Boolean);
            if (sceneList.length) {
              await persistLivePlaylist(sceneList);
              playlistRef.current = incomingPlaylist;
              outputModeRef.current = "playlist";
              setPlaylistReady(true);
              setPlaylistIndex(0);
              playbackStartedAtRef.current = performance.now();
              playbackStartedRef.current = true;
              setState(sceneList[0]!);
            }
          }
          return;
        }

        // This is the explicit reset mechanism: changing the Output Mode in
        // the studio releases the kiosk's locally persisted playlist.
        if (incomingMode !== outputModeRef.current) {
          playlistRef.current = null;
          playbackStartedRef.current = false;
          setPlaylistReady(false);
          await clearLivePlaylist();
          outputModeRef.current = incomingMode;
          setState(incoming);
          setPlaylistOpacity(1);
        } else if (incomingMode !== "playlist") {
          setState(incoming);
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [token]);

  // Local playlist transport. Timing, order, looping and fade values are read
  // only from the persisted snapshot, so the studio is not part of playback.
  useEffect(() => {
    if (!playlistReady) return;
    const tick = () => {
      const playlist = playlistRef.current;
      if (!playlist || !playlist.items.length || !playbackStartedRef.current) return;
      const index = playlistIndex;
      const item = playlist.items[index];
      if (!item) return;
      const duration = Math.max(0.1, Number(item.seconds) || 0.1) * 1000;
      const elapsed = performance.now() - playbackStartedAtRef.current;
      const progress = Math.min(1, elapsed / duration);
      const fade = Math.max(0, Number(item.fade) || 0) * 1000;
      const fadeWindow = Math.min(fade, duration / 2);
      let opacity = 1;
      if (fadeWindow > 0 && elapsed < fadeWindow) opacity = elapsed / fadeWindow;
      else if (fadeWindow > 0 && elapsed > duration - fadeWindow) opacity = (duration - elapsed) / fadeWindow;
      setPlaylistOpacity(Math.max(0, Math.min(1, opacity)));

      if (elapsed < duration) return;
      const nextIndex = index + 1;
      if (nextIndex < playlist.items.length) {
        const next = playlist.items[nextIndex]!;
        const nextScene = playlist.scenes[next.projectId];
        if (nextScene) {
          setPlaylistIndex(nextIndex);
          setState(nextScene);
          playbackStartedAtRef.current = performance.now();
          setPlaylistOpacity(0);
        }
      } else if (playlist.loop) {
        const first = playlist.items[0]!;
        const firstScene = playlist.scenes[first.projectId];
        if (firstScene) {
          setPlaylistIndex(0);
          setState(firstScene);
          playbackStartedAtRef.current = performance.now();
          setPlaylistOpacity(0);
        }
      } else {
        // Hold the final scene indefinitely when looping is disabled.
        playbackStartedRef.current = false;
        setPlaylistOpacity(1);
      }
    };
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [playlistIndex, playlistReady]);

  useEffect(() => {
    let timer = 0;
    const arm = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setShowBadge(false), 5000); };
    const wake = () => { setShowBadge(true); arm(); };
    arm();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "f") toggleFullscreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const blank = status === "paused" || status === "disabled" || status === "unknown";
  const showScene = Boolean(state) && !blank;
  const message = status === "offline"
    ? "Reconnecting to the studio…"
    : status === "live" || status === "unchanged"
      ? null
      : MESSAGES[status];

  return (
    <div ref={shellRef} className="relative h-screen w-screen overflow-hidden bg-black">
      {showScene && state ? (
        <div className="h-full w-full" style={{ opacity: state.outputMode === "playlist" ? playlistOpacity : 1, transition: "opacity 80ms linear" }}>
          <ClientOnly fallback={<div className="h-full w-full bg-black" />}>
            <Suspense fallback={<div className="h-full w-full bg-black" />}>
              <ProjectorViewport state={state} showHandles={false} />
            </Suspense>
          </ClientOnly>
        </div>
      ) : (
        <div className="h-full w-full bg-black" />
      )}

      {message && (blank || !state) ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="max-w-md text-sm text-foreground">{message}</p>
          {allowCodeEntry ? <p className="font-mono text-[11px] text-muted-foreground">code: {token}</p> : null}
          {allowCodeEntry && status === "unknown" ? (
            <button type="button" onClick={() => void navigate({ to: "/p" })} className="rounded-md border border-border px-3 py-1.5 text-[11px] text-foreground">Enter a different code</button>
          ) : null}
        </div>
      ) : null}

      {message && !blank && state && showBadge ? (
        <div className="absolute bottom-3 left-3 z-20 rounded-md border border-border bg-card/85 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">{message}</div>
      ) : null}

      {showBadge ? (
        <ControlDock title="Output" storageKey="spm.dock.remote" defaultPosition={{ x: typeof window === "undefined" ? 16 : Math.max(16, window.innerWidth - 220), y: 16 }} className="w-52">
          <div className="space-y-2">
            <button type="button" onClick={toggleFullscreen} className="flex w-full items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-foreground"><Maximize2 className="size-3" /> Fullscreen (F)</button>
            <button type="button" onClick={autoFullscreen ? disableAutoFullscreen : enableAutoFullscreen} className={`w-full rounded-md border px-2 py-1 ${autoFullscreen ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{autoFullscreen ? "Auto-fullscreen ON" : "Always fullscreen on this device"}</button>
            {cast.state !== "unsupported" ? (
              <button type="button" onClick={() => (cast.state === "casting" ? cast.stopCast() : void cast.startCast())} disabled={cast.state === "connecting" || cast.state === "unavailable"} className={`flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50 ${cast.state === "casting" ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
                <Cast className="size-3" />
                {cast.state === "casting" ? "Stop casting" : cast.state === "connecting" ? "Connecting…" : cast.state === "unavailable" ? "No Cast device" : "Cast to TV"}
              </button>
            ) : null}
            <p className="text-muted-foreground">Controls hide after 5s — tap to show.</p>
          </div>
        </ControlDock>
      ) : null}
    </div>
  );
}
