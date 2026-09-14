import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Move } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";
import type { CornerPin, ProjectState } from "@/lib/projection-types";
import ProjectorViewport from "@/components/ProjectorViewport";

interface Props { state: ProjectState; onCornersChange: (corners: CornerPin[]) => void; }
const MIN_W = 300, MIN_H = 220;

export default function PreviewWindow({ state, onCornersChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 84 });
  const [size, setSize] = useState({ w: 520, h: 340 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) setPos({ x: Math.max(0, drag.current.x + e.clientX - drag.current.px), y: Math.max(0, drag.current.y + e.clientY - drag.current.py) });
      if (resize.current) setSize({ w: Math.max(MIN_W, resize.current.w + e.clientX - resize.current.x), h: Math.max(MIN_H, resize.current.h + e.clientY - resize.current.y) });
    };
    const up = () => { drag.current = null; resize.current = null; };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  return <div className="fixed z-50 overflow-hidden rounded-lg border border-primary/50 bg-card shadow-2xl" style={{ left: pos.x, top: pos.y, width: size.w, height: collapsed ? 38 : size.h }}>
    <div className="flex h-[38px] cursor-move select-none items-center gap-2 border-b border-border bg-card/95 px-2" onPointerDown={(e) => { drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY }; }}>
      <Move className="size-3 text-primary" /><span className="text-xs font-semibold">Preview</span><span className="text-[10px] text-muted-foreground">Live Output</span><span className="ml-auto" />
      <button type="button" title={collapsed ? "Expand preview" : "Collapse preview"} onPointerDown={(e) => e.stopPropagation()} onClick={() => setCollapsed(v => !v)}>{collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}</button>
    </div>
    {!collapsed ? <><div className="h-[calc(100%-38px)]"><ClientOnly fallback={null}><ProjectorViewport state={state} showHandles onCornersChange={onCornersChange} /></ClientOnly></div><div className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize" onPointerDown={(e) => { e.stopPropagation(); resize.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }; }} /></> : null}
  </div>;
}
