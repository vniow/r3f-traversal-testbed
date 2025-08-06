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
// Now also returns a source array: 'object' | 'interpolated' for each point
export function collectVertexScreenData(
  objects: ObjectWithVertices[],
  camera: Camera
): { data: VertexScreenData[]; source: ("object" | "interpolated")[] } {
  let verts: [number, number, number][] = [];
  let colors: [number, number, number][] = [];
  let source: ("object" | "interpolated")[] = [];

  if (objects.length === 0) {
    return { data: [], source: [] };
  }

  // Traverse: for each object, add its vertices, then add interpolated points to next object, looping
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    // Add all vertices from the current object
    verts = verts.concat(obj.points);
    colors = colors.concat(obj.colors);
    source = source.concat(Array(obj.points.length).fill("object"));

    // Interpolate to the next object (looping)
    const nextObj = objects[(i + 1) % objects.length];
    // Only interpolate if both objects have points
    if (obj.points.length > 0 && nextObj.points.length > 0) {
      // Interpolate from last vertex of current to first of next
      const interp = getInterpolatedPoints([obj, nextObj]);
      verts = verts.concat(interp.map(pt => pt.position));
      colors = colors.concat(interp.map(pt => pt.color));
      source = source.concat(Array(interp.length).fill("interpolated"));
    }
  }

  // Project to screen space and collect all values
  const data = verts.map((p, i) => {
    const v = new Vector3(...p);
    const projected = v.project(camera);
    const color = colors[i] || [1, 1, 1];
    // Override Z for visualization: 0 for object, 1 for interpolated
    const zVal = source[i] === "interpolated" ? 1 : 0;
    return {
      screenX: projected.x,
      screenY: projected.y,
      screenZ: zVal,
      r: color[0],
      g: color[1],
      b: color[2],
    };
  });

  return { data, source };
}
