export type Matrix3 = [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface Point {
  x: number;
  y: number;
}

const EPS = 1e-10;

function isFiniteNumber(n: number) {
  return typeof n === "number" && Number.isFinite(n);
}

function validQuad(points: Point[]): boolean {
  if (!Array.isArray(points) || points.length !== 4) return false;
  return points.every((p) => p && isFiniteNumber(p.x) && isFiniteNumber(p.y));
}

/**
 * Solve a linear system A x = b with partial-pivoting Gaussian elimination.
 * Returns null when the system is singular (guards against divide-by-zero).
 */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const w = n + 1;
  // Flat augmented matrix keeps every access a plain number (no undefined).
  const m = new Float64Array(n * w);
  for (let r = 0; r < n; r += 1) {
    const row = A[r] ?? [];
    for (let c = 0; c < n; c += 1) m[r * w + c] = row[c] ?? 0;
    m[r * w + n] = b[r] ?? 0;
  }

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row * w + col]!) > Math.abs(m[pivot * w + col]!)) pivot = row;
    }
    if (Math.abs(m[pivot * w + col]!) < EPS) return null;
    if (pivot !== col) {
      for (let k = 0; k < w; k += 1) {
        const tmp = m[pivot * w + k]!;
        m[pivot * w + k] = m[col * w + k]!;
        m[col * w + k] = tmp;
      }
    }
    const pv = m[col * w + col]!;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = m[row * w + col]! / pv;
      if (!isFiniteNumber(factor)) return null;
      for (let k = col; k < w; k += 1) {
        m[row * w + k] = m[row * w + k]! - factor * m[col * w + k]!;
      }
    }
  }

  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const v = m[i * w + n]! / m[i * w + i]!;
    if (!isFiniteNumber(v)) return null;
    out[i] = v;
  }
  return out;
}

/**
 * Direct Linear Transformation: 3x3 homography mapping src -> dst.
 * Falls back to identity whenever the inputs are incomplete or degenerate,
 * so the render pipeline never receives NaN values.
 */
export function computeHomography(src: Point[], dst: Point[]): Matrix3 {
  if (!validQuad(src) || !validQuad(dst)) return [...IDENTITY] as Matrix3;

  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const s = src[i]!;
    const d = dst[i]!;
    A.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    b.push(d.x);
    A.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    b.push(d.y);
  }

  const h = solve(A, b);
  if (!h) return [...IDENTITY] as Matrix3;

  const matrix: Matrix3 = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
  return matrix.every(isFiniteNumber) ? matrix : ([...IDENTITY] as Matrix3);
}


/** Invert a 3x3 matrix; returns identity when non-invertible. */
export function invert(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!isFiniteNumber(det) || Math.abs(det) < EPS) return [...IDENTITY] as Matrix3;

  const inv: Matrix3 = [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
  return inv.every(isFiniteNumber) ? inv : ([...IDENTITY] as Matrix3);
}

/** Apply a homography to a point. */
export function applyHomography(m: Matrix3, p: Point): Point {
  const denom = m[6] * p.x + m[7] * p.y + m[8];
  if (!isFiniteNumber(denom) || Math.abs(denom) < EPS) return { x: p.x, y: p.y };
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / denom,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / denom,
  };
}

/** Column-major array for GLSL mat3 uniforms. */
export function toGlslMat3(m: Matrix3): number[] {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
