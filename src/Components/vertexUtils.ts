import { useState } from "react";

import { useFrame } from "@react-three/fiber";

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

// -------------------------------------------------------------
// Anchor-Preserving Fixed-Length Resampling
// -------------------------------------------------------------
// We treat every original object vertex as an immutable anchor. To reach a
// target total length W, we ONLY insert or remove interpolated points
// between consecutive anchors (segments). Anchors themselves are never moved
// or removed. If targetLength < anchorCount we clamp up to anchorCount.

export interface ResampledVertexBuffers {
  x: number[];
  y: number[];
  z: number[];
  r: number[];
  g: number[];
  b: number[];
  source: ("object" | "interpolated")[]; // parallel array marking anchor vs interpolated
  anchorIndices: number[]; // indices into the resampled arrays where anchors live (sorted)
  segmentMeta: {
    fromAnchor: number; // anchor index in original anchor sequence
    toAnchor: number; // next anchor index (wrap aware)
    allocated: number; // number of interpolated points placed in this segment
    length: number; // geometric length of the segment
  }[];
}

export interface ResampleOptions {
  closed?: boolean; // whether to wrap last anchor back to first (default true)
  targetLength: number; // desired total points (anchors + interpolated)
  colorInterpolation?: "linear"; // placeholder for future modes
  reuseExisting?: boolean; // future optimization hook (currently ignored)
}

// Compute Euclidean distance between 3D points
function dist3(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Main pure function performing resampling
export function resampleAnchorsWithInterpolatedPoints(objects: ObjectWithVertices[], options: ResampleOptions): ResampledVertexBuffers {
  const { closed = true, targetLength } = options;

  // 1. Collect anchors (positions + colors) in traversal order
  const anchorPositions: [number, number, number][] = [];
  const anchorColors: [number, number, number][] = [];
  const anchorObjectStartIndices: number[] = []; // optional debug (not used yet)
  for (const obj of objects) {
    anchorObjectStartIndices.push(anchorPositions.length);
    for (let i = 0; i < obj.points.length; i++) {
      anchorPositions.push(obj.points[i]);
      anchorColors.push(obj.colors[i] || [1, 1, 1]);
    }
  }
  const A = anchorPositions.length;
  if (A === 0) {
    return {
      x: [],
      y: [],
      z: [],
      r: [],
      g: [],
      b: [],
      source: [],
      anchorIndices: [],
      segmentMeta: [],
    };
  }

  // 2. Determine effective target length (cannot be less than anchors)
  const W = Math.max(targetLength, A);
  const B = W - A; // number of interpolated points required in total

  // 3. Build segments between consecutive anchors
  interface Segment {
    from: number;
    to: number;
    length: number;
    rawAlloc: number;
    alloc: number;
  }
  const segments: Segment[] = [];
  const segmentCount = closed ? A : A - 1;
  for (let i = 0; i < segmentCount; i++) {
    const from = i;
    const to = (i + 1) % A;
    const length = dist3(anchorPositions[from], anchorPositions[to]);
    segments.push({ from, to, length, rawAlloc: 0, alloc: 0 });
  }

  // Edge: if only one anchor and not closed, nothing to interpolate
  if (segments.length === 0) {
    return {
      x: [anchorPositions[0][0]],
      y: [anchorPositions[0][1]],
      z: [anchorPositions[0][2]],
      r: [anchorColors[0][0]],
      g: [anchorColors[0][1]],
      b: [anchorColors[0][2]],
      source: ["object"],
      anchorIndices: [0],
      segmentMeta: [],
    };
  }

  // 4. Allocate interpolated counts proportional to segment length
  const totalLen = segments.reduce((acc, s) => acc + s.length, 0) || 1;
  segments.forEach(s => {
    s.rawAlloc = B * (s.length / totalLen);
    s.alloc = Math.floor(s.rawAlloc);
  });
  // Distribute remainder to segments with largest fractional part
  let remainder = B - segments.reduce((acc, s) => acc + s.alloc, 0);
  if (remainder > 0) {
    const byFrac = [...segments].sort((a, b) => b.rawAlloc - b.alloc - (a.rawAlloc - a.alloc));
    for (let i = 0; i < byFrac.length && remainder > 0; i++) {
      byFrac[i].alloc++;
      remainder--;
    }
  }

  // 5. Build output arrays
  const outX: number[] = [];
  const outY: number[] = [];
  const outZ: number[] = [];
  const outR: number[] = [];
  const outG: number[] = [];
  const outB: number[] = [];
  const source: ("object" | "interpolated")[] = [];
  const anchorIndices: number[] = [];

  // Helper to push a point
  const pushPoint = (pos: [number, number, number], col: [number, number, number], kind: "object" | "interpolated") => {
    outX.push(pos[0]);
    outY.push(pos[1]);
    outZ.push(pos[2]);
    outR.push(col[0]);
    outG.push(col[1]);
    outB.push(col[2]);
    source.push(kind);
    if (kind === "object") anchorIndices.push(outX.length - 1);
  };

  // To avoid duplicating the first anchor when closed, we will:
  // - Always push anchorPositions[0]
  // - For each segment, push its interpolated points + destination anchor (unless open and last segment)
  pushPoint(anchorPositions[0], anchorColors[0], "object");

  const segmentMeta: ResampledVertexBuffers["segmentMeta"] = [];

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const s = segments[sIdx];
    const fromPos = anchorPositions[s.from];
    const toPos = anchorPositions[s.to];
    const fromCol = anchorColors[s.from];
    const toCol = anchorColors[s.to];

    // Insert s.alloc interpolated points (evenly spaced t in (0,1))
    for (let k = 1; k <= s.alloc; k++) {
      const t = k / (s.alloc + 1);
      const ip: [number, number, number] = [
        fromPos[0] + (toPos[0] - fromPos[0]) * t,
        fromPos[1] + (toPos[1] - fromPos[1]) * t,
        fromPos[2] + (toPos[2] - fromPos[2]) * t,
      ];
      // Mark z for interpolated points if you use it as intensity (keep existing convention: original z preserved, maybe set 0?)
      // We'll leave interpolation on z as is (already linear) — user can post-process.
      const ic: [number, number, number] = [
        fromCol[0] + (toCol[0] - fromCol[0]) * t,
        fromCol[1] + (toCol[1] - fromCol[1]) * t,
        fromCol[2] + (toCol[2] - fromCol[2]) * t,
      ];
      // Optionally force z=0 to indicate interpolated like existing code did:
      // ip[2] = 0;
      pushPoint(ip, ic, "interpolated");
    }

    // Push destination anchor if:
    // - Not the very first anchor (already added) AND
    // - Either not wrapping at end OR open path or (closed and not last segment)
    const isLastSegment = sIdx === segments.length - 1;
    if (!(closed && isLastSegment)) {
      // For open path we push all anchors; for closed path we avoid duplicating first at end
      if (!(s.to === 0 && closed)) {
        pushPoint(toPos, toCol, "object");
      }
    }

    segmentMeta.push({ fromAnchor: s.from, toAnchor: s.to, allocated: s.alloc, length: s.length });
  }

  return {
    x: outX,
    y: outY,
    z: outZ,
    r: outR,
    g: outG,
    b: outB,
    source,
    anchorIndices,
    segmentMeta,
  };
}

// React hook wrapper: recalculates every frame (could be optimized later to only when objects/target change)
export function useResampledVertexTraversal(objects: ObjectWithVertices[], targetLength: number, closed = true) {
  const [buffers, setBuffers] = useState<ResampledVertexBuffers>(() =>
    resampleAnchorsWithInterpolatedPoints(objects, { targetLength, closed })
  );

  useFrame(() => {
    const result = resampleAnchorsWithInterpolatedPoints(objects, { targetLength, closed });
    setBuffers(result);
  });

  return buffers;
}

// Utility to log world and screen coordinates for each vertex of each object, on every frame
// export function useLogVertices(objects: ObjectWithVertices[]) {
//   const { camera } = useThree();

//   // Helper to create the vertex info object
//   // function getVertexInfo(objName: string, idx: number, p: [number, number, number], color: [number, number, number], label = "vertex") {
//   //   const v = new Vector3(...p);
//   //   const projected = v.clone().project(camera);
//   //   // Normalized device coordinates (NDC) are already in [-1, 1] for x and y
//   //   // We'll keep the sign for y (no flip)
//   //   return {
//   //     object: objName,
//   //     label,
//   //     index: idx,
//   //     x: p[0],
//   //     y: p[1],
//   //     z: p[2],
//   //     r: color[0],
//   //     g: color[1],
//   //     b: color[2],
//   //     screen: { x: projected.x, y: projected.y },
//   //   };
//   // }
// }
