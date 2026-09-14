/**
 * GLSL visual sources. Shadertoy-style fragment shaders (a `mainImage`
 * function) render into an offscreen WebGL canvas that any layer can use as
 * its fill, in both the editor and the live output.
 */

import { getSignals } from "./live-sources";

export interface ShaderPreset {
  id: string;
  name: string;
  source: string;
  code: string;
}

const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

function wrap(code: string) {
  return `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iAudio; // level, bass, mid, treble
out vec4 fragColor_;
${code}
void main(){
  vec4 c = vec4(0.0);
  mainImage(c, gl_FragCoord.xy);
  fragColor_ = vec4(c.rgb, 1.0);
}`;
}

export const SHADER_PRESETS: ShaderPreset[] = [
  {
    id: "plasma",
    name: "Plasma flow",
    source: "Classic Shadertoy plasma (public domain)",
    code: `void mainImage(out vec4 o, in vec2 fc){
  vec2 uv = fc / iResolution.xy;
  float t = iTime * 0.6 + iAudio.y * 3.0;
  float v = sin(uv.x * 10.0 + t) + sin(uv.y * 12.0 - t) + sin((uv.x + uv.y) * 8.0 + t * 1.3);
  vec3 col = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + v * 1.4);
  o = vec4(col, 1.0);
}`,
  },
  {
    id: "tunnel",
    name: "Warp tunnel",
    source: "Public-domain raymarch tunnel",
    code: `void mainImage(out vec4 o, in vec2 fc){
  vec2 uv = (fc - 0.5 * iResolution.xy) / iResolution.y;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float t = iTime * 0.8;
  float bands = sin(10.0 / max(r, 0.05) - t * 3.0 + a * 4.0);
  vec3 col = mix(vec3(0.02, 0.05, 0.12), vec3(0.2, 0.9, 1.0), 0.5 + 0.5 * bands);
  col *= smoothstep(1.1, 0.1, r) * (0.7 + iAudio.x);
  o = vec4(col, 1.0);
}`,
  },
  {
    id: "spectrum",
    name: "Audio bars",
    source: "Reacts to the microphone",
    code: `void mainImage(out vec4 o, in vec2 fc){
  vec2 uv = fc / iResolution.xy;
  float band = floor(uv.x * 16.0) / 16.0;
  float h = mix(iAudio.y, iAudio.w, band) * (0.4 + 0.9 * abs(sin(band * 12.0 + iTime)));
  float on = step(uv.y, h);
  vec3 col = mix(vec3(0.05), vec3(0.1 + band, 1.0 - band, 0.9), on);
  o = vec4(col * on, 1.0);
}`,
  },
  {
    id: "ripple",
    name: "Milk ripple",
    source: "Butterchurn-style ripple",
    code: `void mainImage(out vec4 o, in vec2 fc){
  vec2 uv = (fc - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime * 0.5;
  float d = length(uv) * 8.0 - t * 4.0 - iAudio.z * 6.0;
  float w = sin(d) * exp(-length(uv) * 1.2);
  vec3 col = 0.5 + 0.5 * cos(vec3(0.0, 1.6, 3.2) + w * 6.0 + t);
  o = vec4(col * (0.5 + 0.6 * abs(w)), 1.0);
}`,
  },
];

interface Instance {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  start: number;
  error: string | null;
}

const instances = new Map<string, Instance>();
let rafId = 0;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "shader compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function build(id: string, code: string): Instance | null {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return null;
  try {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, wrap(code)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const instance: Instance = { canvas, gl, program, start: performance.now(), error: null };
    instances.set(id, instance);
    ensureLoop();
    return instance;
  } catch (cause) {
    const instance: Instance = {
      canvas,
      gl,
      program: null as unknown as WebGLProgram,
      start: 0,
      error: cause instanceof Error ? cause.message : "Shader failed to compile",
    };
    instances.set(id, instance);
    return instance;
  }
}

function ensureLoop() {
  if (rafId || typeof requestAnimationFrame === "undefined") return;
  const frame = () => {
    const signals = getSignals();
    for (const instance of instances.values()) {
      if (instance.error) continue;
      const { gl, program, canvas } = instance;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(gl.getUniformLocation(program, "iResolution"), canvas.width, canvas.height, 1);
      gl.uniform1f(
        gl.getUniformLocation(program, "iTime"),
        (performance.now() - instance.start) / 1000,
      );
      gl.uniform4f(
        gl.getUniformLocation(program, "iAudio"),
        signals.level,
        signals.bass,
        signals.mid,
        signals.treble,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

/** Live canvas for a shader asset (null when WebGL2 is unavailable). */
export function getShaderCanvas(id: string, code: string): HTMLCanvasElement | null {
  const existing = instances.get(id);
  if (existing) return existing.canvas;
  return build(id, code)?.canvas ?? null;
}

export function getShaderError(id: string): string | null {
  return instances.get(id)?.error ?? null;
}

export function dropShader(id: string) {
  instances.delete(id);
}

/** Pull GLSL out of a pasted Shadertoy/gist/raw URL when the host allows it. */
export async function fetchShaderCode(url: string): Promise<string> {
  const trimmed = url.trim();
  const shadertoy = /shadertoy\.com\/view\/([A-Za-z0-9]+)/.exec(trimmed);
  const target = shadertoy
    ? `https://www.shadertoy.com/api/v1/shader/${shadertoy[1]}?key=Nt8tw7`
    : trimmed;
  const res = await fetch(target);
  if (!res.ok) throw new Error(`Could not fetch (${res.status})`);
  const text = await res.text();
  if (shadertoy) {
    try {
      const json = JSON.parse(text) as {
        Shader?: { renderpass?: { code?: string }[] };
        Error?: string;
      };
      const code = json.Shader?.renderpass?.[0]?.code;
      if (!code) throw new Error(json.Error ?? "Shader is not shared via the public API");
      return code;
    } catch (cause) {
      throw new Error(
        cause instanceof Error ? cause.message : "Shader is not shared via the public API",
      );
    }
  }
  if (!/mainImage\s*\(/.test(text)) throw new Error("No mainImage() function in that file");
  return text;
}
