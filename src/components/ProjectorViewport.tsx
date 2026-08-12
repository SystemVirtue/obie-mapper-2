import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  computeHomography,
  invert,
  toGlslMat3,
  type Matrix3,
} from "@/lib/homography";
import { drawStage } from "@/lib/stage-renderer";
import type { CornerPin, ProjectState } from "@/lib/projection-types";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform mat3 uInverseHomography;
  uniform float uGainLeft;
  uniform float uGainRight;
  uniform float uBrightness;

  void main() {
    vec2 dest = vec2(vUv.x, 1.0 - vUv.y);
    vec3 src = uInverseHomography * vec3(dest, 1.0);
    if (abs(src.z) < 1e-6) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec2 uv = src.xy / src.z;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec4 color = texture2D(uTexture, uv);
    // Horizontal falloff compensation across the throw distance.
    float gain = mix(uGainLeft, uGainRight, uv.x) * uBrightness;
    gl_FragColor = vec4(clamp(color.rgb * gain, 0.0, 1.0), 1.0);
  }
`;


interface Props {
  state: ProjectState;
  onCornersChange?: (corners: CornerPin[]) => void;
  showHandles?: boolean;
  /** Receives the live WebGL canvas (used for MP4 recording). */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

const LABELS = ["TL", "TR", "BR", "BL"];

export default function ProjectorViewport({
  state,
  onCornersChange,
  showHandles,
  onCanvasReady,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const canvasReadyRef = useRef(onCanvasReady);
  canvasReadyRef.current = onCanvasReady;
  const [fallback, setFallback] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);

  const homography = useMemo<Matrix3>(() => {
    const src = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    return computeHomography(src, state.corners);
  }, [state.corners]);

  const inverse = useMemo(() => invert(homography), [homography]);
  const inverseRef = useRef(inverse);
  inverseRef.current = inverse;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const source = document.createElement("canvas");
    source.width = stateRef.current.stageWidth;
    source.height = stateRef.current.stageHeight;
    const ctx = source.getContext("2d");
    const texture = new THREE.CanvasTexture(source);
    texture.flipY = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    canvasReadyRef.current?.(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTexture: { value: texture },
      uInverseHomography: { value: new THREE.Matrix3().fromArray(toGlslMat3(inverseRef.current)) },
      uGainLeft: { value: stateRef.current.gainLeft },
      uGainRight: { value: stateRef.current.gainRight },
      uBrightness: { value: stateRef.current.brightness },
    };


    let material: THREE.Material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
    });
    let usingShader = true;
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    try {
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
    } catch {
      // Fallback: plain textured quad (matrix-warped vertices, no custom GLSL).
      usingShader = false;
      setFallback(true);
      material.dispose();
      material = new THREE.MeshBasicMaterial({ map: texture });
      mesh.material = material;
    }

    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const start = performance.now();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const s = stateRef.current;
      if (source.width !== s.stageWidth || source.height !== s.stageHeight) {
        source.width = s.stageWidth;
        source.height = s.stageHeight;
      }
      if (ctx) drawStage(ctx, s, (performance.now() - start) / 1000);
      texture.needsUpdate = true;

      if (usingShader) {
        uniforms.uInverseHomography.value.fromArray(toGlslMat3(inverseRef.current));
        uniforms.uGainLeft.value = s.gainLeft;
        uniforms.uGainRight.value = s.gainRight;
        uniforms.uBrightness.value = Number.isFinite(s.brightness) ? s.brightness : 1;

      } else {
        // Warp the quad vertices with the corner pins instead of in the shader.
        const attr = geometry.attributes["position"] as THREE.BufferAttribute;
        const order = [3, 2, 0, 1]; // plane vertex order: TL, TR, BL, BR
        const pins = s.corners;
        for (let i = 0; i < 4; i += 1) {
          const pin = pins[order[i] ?? 0] ?? { x: 0, y: 0 };
          attr.setXY(i, pin.x * 2 - 1, 1 - pin.y * 2);
        }
        attr.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const handlePointerDown = useCallback((index: number) => setDragging(index), []);

  useEffect(() => {
    if (dragging === null || !onCornersChange) return;
    const host = hostRef.current;
    if (!host) return;

    const move = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      const next = stateRef.current.corners.map((c, i) => (i === dragging ? { x, y } : c));
      onCornersChange(next);
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, onCornersChange]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={hostRef} className="h-full w-full" />
      {showHandles && onCornersChange
        ? state.corners.map((corner, index) => (
            <button
              key={index}
              type="button"
              onPointerDown={() => handlePointerDown(index)}
              style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-primary bg-background/80 px-2 py-1 text-[10px] font-semibold text-primary shadow-lg active:cursor-grabbing"
            >
              {LABELS[index]}
            </button>
          ))
        : null}
      {fallback ? (
        <p className="absolute bottom-2 left-2 z-10 rounded bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
          Shader unavailable — using geometry warp fallback
        </p>
      ) : null}
    </div>
  );
}
