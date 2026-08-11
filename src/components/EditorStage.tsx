import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";

import { getMediaElement, isReady } from "@/lib/media-cache";
import type { ProjectionNode, ProjectState } from "@/lib/projection-types";

interface Props {
  state: ProjectState;
  onSelect: (id: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<ProjectionNode>) => void;
}

function useHtmlImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return image;
}

export default function EditorStage({ state, onSelect, onUpdateNode }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ width: 960, height: 540 });
  const background = useHtmlImage(state.background.url);

  const scale = useMemo(() => {
    const fitW = size.width / state.stageWidth;
    const fitH = size.height / state.stageHeight;
    return Math.max(0.05, Math.min(fitW, fitH));
  }, [size, state.stageWidth, state.stageHeight]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep video-backed nodes animating without React re-renders.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const anim = new Konva.Animation(() => undefined, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer) return;
    const node = state.selectedId ? layer.findOne(`#${state.selectedId}`) : null;
    transformer.nodes(node ? [node] : []);
  }, [state.selectedId, state.nodes]);

  const stageWidth = Math.max(1, Math.floor(state.stageWidth * scale));
  const stageHeight = Math.max(1, Math.floor(state.stageHeight * scale));
  const ready = size.width > 1 && size.height > 1;

  const commonHandlers = (node: ProjectionNode) => ({
    id: node.id,
    draggable: true,
    onClick: () => onSelect(node.id),
    onTap: () => onSelect(node.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onUpdateNode(node.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const target = e.target;
      const sx = target.scaleX();
      const sy = target.scaleY();
      target.scaleX(1);
      target.scaleY(1);
      onUpdateNode(node.id, {
        x: target.x(),
        y: target.y(),
        rotation: target.rotation(),
        width: Math.max(8, node.width * sx),
        height: Math.max(8, node.height * sy),
        points:
          node.kind === "polygon"
            ? node.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy))
            : node.points,
      });
    },
  });

  const fillProps = (node: ProjectionNode) => {
    if (node.media === "color") return { fill: node.color };
    const asset = state.assets.find((a) => a.id === node.assetId) ?? null;
    const el = getMediaElement(asset);
    if (!isReady(el) || !el) return { fill: node.color };
    const sw = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
    const sh = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
    if (!sw || !sh) return { fill: node.color };
    const fit = Math.max(node.width / sw, node.height / sh);
    if (!Number.isFinite(fit) || fit <= 0) return { fill: node.color };
    return {
      fillPatternImage: el as unknown as HTMLImageElement,
      fillPatternScale: { x: fit, y: fit },
      fillPatternRepeat: "no-repeat",
    };
  };

  if (!ready) {
    return <div ref={wrapperRef} className="h-full w-full" />;
  }

  return (
    <div ref={wrapperRef} className="flex h-full w-full items-center justify-center p-4">
      <div
        className="relative shadow-2xl ring-1 ring-border"
        style={{ width: stageWidth, height: stageHeight }}
      >
        <Stage
          width={stageWidth}
          height={stageHeight}
          scale={{ x: scale, y: scale }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
          style={{ background: "#05070d" }}
        >
          <Layer ref={layerRef}>
            {background && state.background.visible ? (
              <KonvaImage
                image={background}
                width={state.stageWidth}
                height={state.stageHeight}
                opacity={state.background.opacity}
                listening={false}
              />
            ) : null}

            {state.showGrid
              ? Array.from({ length: 9 }, (_, i) => (
                  <Line
                    key={`grid-${i}`}
                    points={[
                      ((i + 1) * state.stageWidth) / 10,
                      0,
                      ((i + 1) * state.stageWidth) / 10,
                      state.stageHeight,
                    ]}
                    stroke="rgba(148,163,184,0.15)"
                    strokeWidth={1}
                    listening={false}
                  />
                ))
              : null}

            {state.nodes.map((node) => {
              if (!node.visible) return null;
              if (node.kind === "polygon") {
                return (
                  <Line
                    key={node.id}
                    {...commonHandlers(node)}
                    x={node.x}
                    y={node.y}
                    rotation={node.rotation}
                    opacity={node.opacity}
                    points={node.points}
                    closed
                    stroke={state.selectedId === node.id ? "#38bdf8" : "rgba(148,163,184,0.6)"}
                    strokeWidth={2 / scale}
                    shadowColor={node.glow ? node.color : "transparent"}
                    shadowBlur={node.glow ? 20 + node.glowIntensity * 60 : 0}
                    {...fillProps(node)}
                  />
                );
              }

              if (node.kind === "particles") {
                return (
                  <Rect
                    key={node.id}
                    {...commonHandlers(node)}
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rotation={node.rotation}
                    opacity={node.opacity}
                    dash={[8, 6]}
                    stroke={node.color}
                    strokeWidth={2 / scale}
                    fill="rgba(252,211,77,0.08)"
                  />
                );
              }

              return (
                <Rect
                  key={node.id}
                  {...commonHandlers(node)}
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rotation={node.rotation}
                  opacity={node.opacity}
                  stroke={state.selectedId === node.id ? "#38bdf8" : "rgba(148,163,184,0.6)"}
                  strokeWidth={2 / scale}
                  shadowColor={node.glow ? node.color : "transparent"}
                  shadowBlur={node.glow ? 20 + node.glowIntensity * 60 : 0}
                  {...fillProps(node)}
                />
              );
            })}

            {state.nodes
              .filter((n) => n.kind === "particles" && n.visible)
              .map((n) => (
                <Text
                  key={`${n.id}-label`}
                  x={n.x + 8}
                  y={n.y + 8}
                  text={"\u266A particles"}
                  fill={n.color}
                  fontSize={16}
                  listening={false}
                />
              ))}

            {state.nodes
              .filter((n) => n.id === state.selectedId && n.kind === "polygon")
              .flatMap((n) =>
                n.points.reduce<{ id: string; x: number; y: number }[]>((acc, _v, i) => {
                  if (i % 2 !== 0) return acc;
                  acc.push({
                    id: `${n.id}-${i}`,
                    x: n.x + (n.points[i] ?? 0),
                    y: n.y + (n.points[i + 1] ?? 0),
                  });
                  return acc;
                }, []),
              )
              .map((p) => (
                <Circle key={p.id} x={p.x} y={p.y} radius={5 / scale} fill="#38bdf8" listening={false} />
              ))}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              anchorSize={9}
              borderStroke="#38bdf8"
              anchorStroke="#38bdf8"
              anchorFill="#0f172a"
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
