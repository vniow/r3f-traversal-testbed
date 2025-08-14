import type { ObjectWithVertices } from "./vertexUtils";

// Simple HSV to RGB converter (h in [0,1])
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, t, v][mod];
  const g = [t, v, v, q, p, p][mod];
  const b = [p, p, t, v, v, q][mod];
  return [r, g, b];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Bounds within which polygon centers are placed (orthographic camera ~ [-3,3])
const VIEW_LIMIT = 3;

export interface GeneratePolygonOptions {
  minSides?: number;
  maxSides?: number;
  minRadius?: number;
  maxRadius?: number;
}

export function generateRegularPolygon(options: GeneratePolygonOptions = {}): ObjectWithVertices {
  const { minSides = 3, maxSides = 9, minRadius = 0.4, maxRadius = 1.0 } = options;
  const sides = Math.max(3, randInt(minSides, maxSides));
  const radius = lerp(minRadius, maxRadius, Math.random());
  const rotation = Math.random() * Math.PI * 2;

  // Keep polygon fully inside bounds (simple approach: center range shrinks by radius)
  const margin = radius + 0.1;
  const range = VIEW_LIMIT - margin;
  const cx = (Math.random() * 2 - 1) * range;
  const cy = (Math.random() * 2 - 1) * range;

  const points: [number, number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), 0]);
  }
  // Close polygon
  points.push(points[0]);

  // Colors: simple hue gradient along perimeter
  const colors: [number, number, number][] = points.map((_, i) => {
    const hue = (i / (points.length - 1)) % 1; // last repeat same hue as first
    return hsvToRgb(hue, 1, 1);
  });

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `Poly${sides}`,
    points,
    colors,
  };
}
