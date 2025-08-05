import { Vector3, Camera } from "three";
import { getInterpolatedPoints } from "./vertexUtils";
import type { ObjectWithVertices } from "./vertexUtils";

// Type for collected screen-space vertex data
export interface VertexScreenData {
  screenX: number;
  screenY: number;
  screenZ: number;
  r: number;
  g: number;
  b: number;
}

// Utility to collect all vertex screen-space data (x, y, z, r, g, b) from objects and their interpolated points
export function collectVertexScreenData(objects: ObjectWithVertices[], camera: Camera): VertexScreenData[] {
  let verts: [number, number, number][] = [];
  let colors: [number, number, number][] = [];

  // Collect vertices and colors from objects
  objects.forEach(obj => {
    verts = verts.concat(obj.points);
    colors = colors.concat(obj.colors);
  });

  // Add interpolated points and their colors
  const interp = getInterpolatedPoints(objects);
  verts = verts.concat(interp.map(pt => pt.position));
  colors = colors.concat(interp.map(pt => pt.color));

  // Project to screen space and collect all values
  const data = verts.map((p, i) => {
    const v = new Vector3(...p);
    const projected = v.project(camera);
    const color = colors[i] || [1, 1, 1];
    return {
      screenX: projected.x,
      screenY: projected.y,
      screenZ: projected.z,
      r: color[0],
      g: color[1],
      b: color[2],
    };
  });

  return data;
}
