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
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < EPS) return null;
    if (pivot !== col) {
      const tmp = m[pivot];
      m[pivot] = m[col];
      m[col] = tmp;
    }
    const pv = m[col][col];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = m[row][col] / pv;
      if (!isFiniteNumber(factor)) return null;
      for (let k = col; k <= n; k += 1) {
        m[row][k] -= factor * m[col][k];
      }
    }
  }

  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const v = m[i][n] / m[i][i];
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
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = solve(A, b);
  if (!h) return [...IDENTITY] as Matrix3;

  const matrix: Matrix3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
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
