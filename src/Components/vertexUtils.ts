import { Vector3 } from "three";
import { useThree, useFrame } from "@react-three/fiber";

// Type for objects with vertices
export type ObjectWithVertices = {
  name: string;
  points: [number, number, number][];
  colors: [number, number, number][];
};

// Utility to get interpolated points between objects
export function getInterpolatedPoints(objects: ObjectWithVertices[]) {
  const points: { position: [number, number, number], color: [number, number, number], key: string }[] = [];
  for (let i = 0; i < objects.length - 1; i++) {
    const objA = objects[i];
    const objB = objects[i + 1];
    const a = objA.points[objA.points.length - 1];
    const b = objB.points[0];
    const colorA = objA.colors[objA.colors.length - 1] || [1, 1, 1];
    const colorB = objB.colors[0] || [1, 1, 1];
    const numInterp = 15;
    for (let j = 1; j <= numInterp; j++) {
      const t = j / (numInterp + 1);
      const interp = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ] as [number, number, number];
      const interpColor = [
        colorA[0] + (colorB[0] - colorA[0]) * t,
        colorA[1] + (colorB[1] - colorA[1]) * t,
        colorA[2] + (colorB[2] - colorA[2]) * t,
      ] as [number, number, number];
      points.push({ position: interp, color: interpColor, key: `${objA.name}->${objB.name}-${j}` });
    }
  }
  return points;
}

// Utility to log world and screen coordinates for each vertex of each object, on every frame
export function useLogVertices(objects: ObjectWithVertices[]) {
  const { camera } = useThree();

  // Helper to create the vertex info object
  function getVertexInfo(objName: string, idx: number, p: [number, number, number], color: [number, number, number], label = "vertex") {
    const v = new Vector3(...p);
    const projected = v.clone().project(camera);
    // Normalized device coordinates (NDC) are already in [-1, 1] for x and y
    // We'll keep the sign for y (no flip)
    return {
      object: objName,
      label,
      index: idx,
      x: p[0],
      y: p[1],
      z: p[2],
      r: color[0],
      g: color[1],
      b: color[2],
      screen: { x: projected.x, y: projected.y }
    };
  }

  useFrame(() => {
    // Log all object vertices
    objects.forEach(obj => {
      obj.points.forEach((p, i) => {
        const color = obj.colors[i] || [1, 1, 1];
        const info = getVertexInfo(obj.name, i, p, color);
        console.log(info);
      });
    });

    // Log interpolated points between each object (from last vertex of one to first of next)
    const interpPoints = getInterpolatedPoints(objects);
    interpPoints.forEach((pt, i) => {
      const info = getVertexInfo("interp", i, pt.position, pt.color, "interp");
      console.log(info);
    });
  });
}
