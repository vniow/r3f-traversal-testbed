// import { useState } from "react";

// import { useFrame } from "@react-three/fiber";

// Type for objects with vertices
export type ObjectWithVertices = {
  id?: string; // optional unique identifier for dynamic objects
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
    const numInterp = 3;

    for (let j = 1; j <= numInterp; j++) {
      const t = j / (numInterp + 1);
      const interp = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [number, number, number];
      // Set z=1 for interpolated points only
      interp[2] = 0;
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
