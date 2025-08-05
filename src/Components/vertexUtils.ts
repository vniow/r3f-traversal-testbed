import { useState } from "react";
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
  const points: { position: [number, number, number]; color: [number, number, number]; key: string }[] = [];

  // Interpolate between each consecutive pair, including wrapping back to the first
  for (let i = 0; i < objects.length; i++) {
    const objA = objects[i];
    const objB = objects[(i + 1) % objects.length]; // Wrap around to first object

    // Use the actual last vertex to ensure complete traversal of the object
    const a = objA.points[objA.points.length - 1];
    const b = objB.points[0];
    const colorA = objA.colors[objA.colors.length - 1] || [1, 1, 1];
    const colorB = objB.colors[0] || [1, 1, 1];
    const numInterp = 15;

    for (let j = 1; j <= numInterp; j++) {
      const t = j / (numInterp + 1);
      const interp = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [number, number, number];
      // Set z=1 for interpolated points only
      interp[2] = 1;
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

/**
 * A hook that traverses a series of objects and their interpolated paths,
 * and returns the complete vertex data in six separate buffers.
 * The traversal order is: Object -> Interpolation -> Next Object -> ...
 */
export function useVertexTraversal(objects: ObjectWithVertices[]) {
  const [buffers, setBuffers] = useState<{
    x: number[];
    y: number[];
    z: number[];
    r: number[];
    g: number[];
    b: number[];
  }>({ x: [], y: [], z: [], r: [], g: [], b: [] });

  useFrame(() => {
    const newX: number[] = [];
    const newY: number[] = [];
    const newZ: number[] = [];
    const newR: number[] = [];
    const newG: number[] = [];
    const newB: number[] = [];

    if (objects.length === 0) {
      setBuffers({ x: newX, y: newY, z: newZ, r: newR, g: newG, b: newB });

      return;
    }

    // The main traversal loop
    for (let i = 0; i < objects.length; i++) {
      const currentObject = objects[i];

      // 1. Add all vertices from the current object to the buffers
      currentObject.points.forEach((p, j) => {
        const color = currentObject.colors[j] || [1, 1, 1];
        newX.push(p[0]);
        newY.push(p[1]);
        newZ.push(p[2]);
        newR.push(color[0]);
        newG.push(color[1]);
        newB.push(color[2]);
      });
      console.log(`Traversing object: ${currentObject.name} with ${currentObject.points.length} vertices`);

      // 2. Add the interpolated points between the current and next object
      const interpolated = getInterpolatedPoints([currentObject, objects[(i + 1) % objects.length]]);
      interpolated.forEach(pt => {
        newX.push(pt.position[0]);
        newY.push(pt.position[1]);
        newZ.push(pt.position[2]);
        newR.push(pt.color[0]);
        newG.push(pt.color[1]);
        newB.push(pt.color[2]);
      });
    }

    setBuffers({ x: newX, y: newY, z: newZ, r: newR, g: newG, b: newB });
  });

  return buffers;
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
      screen: { x: projected.x, y: projected.y },
    };
  }

  useFrame(() => {
    // Log all object vertices
    objects.forEach(obj => {
      obj.points.forEach((p, i) => {
        const color = obj.colors[i] || [1, 1, 1];
        const info = getVertexInfo(obj.name, i, p, color);
        // console.log(info);
      });
    });

    // Log interpolated points between each object (from last vertex of one to first of next)
    const interpPoints = getInterpolatedPoints(objects);
    interpPoints.forEach((pt, i) => {
      const info = getVertexInfo("interp", i, pt.position, pt.color, "interp");
      //   console.log(info);
    });
  });
}
