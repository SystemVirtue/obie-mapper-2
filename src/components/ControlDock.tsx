import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

interface Props {
  title: string;
  storageKey: string;
  children: React.ReactNode;
  /** Initial position in px from the top-left of the viewport. */
  defaultPosition?: { x: number; y: number };
  className?: string;
}

interface Placement {
  x: number;
  y: number;
  collapsed: boolean;
}

function readPlacement(key: string, fallback: Placement): Placement {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Placement>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : fallback.x,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : fallback.y,
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return fallback;
  }
}

/**
 * Floating control panel that can be dragged anywhere on screen and collapsed,
 * so it never blocks the corner-pin handles underneath it.
 */
export default function ControlDock({
  title,
  storageKey,
  children,
  defaultPosition,
  className,
}: Props) {
  const fallback: Placement = {
    x: defaultPosition?.x ?? 16,
    y: defaultPosition?.y ?? 16,
    collapsed: false,
  };
  const [placement, setPlacement] = useState<Placement>(fallback);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlacement(readPlacement(storageKey, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: Placement) => {
      setPlacement(next);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore quota errors */
        }
      }
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      const box = boxRef.current;
      if (!drag || !box) return;
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      const x = Math.min(
        Math.max(0, event.clientX - drag.dx),
        Math.max(0, window.innerWidth - width),
      );
      const y = Math.min(
        Math.max(0, event.clientY - drag.dy),
        Math.max(0, window.innerHeight - height),
      );
      setPlacement((prev) => ({ ...prev, x, y }));
    },
    [],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    persist(placement);
  }, [persist, placement]);

  return (
    <div
      ref={boxRef}
      style={{ left: placement.x, top: placement.y }}
      className={`fixed z-30 rounded-md border border-border bg-card/90 text-[11px] text-foreground shadow-xl backdrop-blur ${className ?? ""}`}
    >
      <div className="flex items-center gap-1 border-b border-border/70 px-2 py-1.5">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag to move"
          className="flex cursor-grab touch-none items-center gap-1 text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
          <span className="font-semibold text-foreground">{title}</span>
        </button>
        <button
          type="button"
          onClick={() => persist({ ...placement, collapsed: !placement.collapsed })}
          className="ml-auto rounded border border-border px-1 py-0.5 text-muted-foreground"
          title={placement.collapsed ? "Expand controls" : "Collapse controls"}
        >
          {placement.collapsed ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      </div>
      {placement.collapsed ? null : <div className="p-2">{children}</div>}
    </div>
  );
}
