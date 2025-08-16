import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DebugAudioEngine } from "./DebugAudioEngine";

/*
 MVP: Sample-accurate waveform using a single dynamic BufferGeometry quad.
 We push vertices as a strip forming a thin ribbon: for each sample i we create two vertices (top/bottom) whose x encodes sample index and y encodes normalized amplitude.
 Fragment shader just colors the quad; geometry encodes the waveform silhouette.
*/

interface Props {
  engine: DebugAudioEngine;
  channel?: number;
  windowSize?: number; // samples displayed
  amplitude?: number; // vertical scale
  thickness?: number; // half thickness of ribbon
  color?: THREE.ColorRepresentation;
}

export function WaveformQuad({ engine, channel = 0, windowSize = 2048, amplitude = 1, thickness = 0.02, color = "#0ff" }: Props) {
  const geomRef = useRef<THREE.BufferGeometry | null>(null);
  const sampleBuf = useMemo(() => new Float32Array(windowSize), [windowSize]);

  // We need 2 verts per sample (top & bottom) -> windowSize * 2
  const vertCount = windowSize * 2;
  const positions = useMemo(() => new Float32Array(vertCount * 3), [vertCount]);
  const uvs = useMemo(() => new Float32Array(vertCount * 2), [vertCount]);
  const indices = useMemo(() => {
    const idx = new Uint32Array((windowSize - 1) * 6);
    let o = 0;
    for (let i = 0; i < windowSize - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // two triangles (a,b,c) and (b,d,c)
      idx[o++] = a;
      idx[o++] = b;
      idx[o++] = c;
      idx[o++] = b;
      idx[o++] = d;
      idx[o++] = c;
    }
    return idx;
  }, [windowSize]);

  // Initialize static X + UVs
  useMemo(() => {
    for (let i = 0; i < windowSize; i++) {
      const xNorm = i / (windowSize - 1); // 0..1
      const x = xNorm * 2 - 1; // -1..1
      const top = i * 2;
      const bot = top + 1;
      positions[3 * top + 0] = x;
      positions[3 * top + 1] = thickness; // baseline offset; updated each frame
      positions[3 * top + 2] = 0;
      positions[3 * bot + 0] = x;
      positions[3 * bot + 1] = -thickness;
      positions[3 * bot + 2] = 0;
      uvs[2 * top + 0] = xNorm;
      uvs[2 * top + 1] = 1;
      uvs[2 * bot + 0] = xNorm;
      uvs[2 * bot + 1] = 0;
    }
  }, [positions, uvs, thickness, windowSize]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.9 }), [color]);

  useFrame(() => {
    if (!geomRef.current) return;
    const wrote = engine.getLatestSamples(channel, sampleBuf);
    if (!wrote) return;
    // map sample amplitude to ribbon top/bottom
    for (let i = 0; i < wrote; i++) {
      const s = sampleBuf[i] * amplitude; // sample amplitude
      const top = i * 2;
      const bot = top + 1;
      positions[3 * top + 1] = s + thickness; // upper edge (centered around 0)
      positions[3 * bot + 1] = s - thickness; // lower edge
    }
    // zero tail if less than windowSize
    for (let i = wrote; i < windowSize; i++) {
      const top = i * 2;
      const bot = top + 1;
      positions[3 * top + 1] = thickness;
      positions[3 * bot + 1] = -thickness;
    }
    const geom = geomRef.current;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  });

  // Build geometry once
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    geomRef.current = g;
    return g;
  }, [positions, uvs, indices]);

  return (
    <mesh frustumCulled={false} geometry={geometry}>
      <primitive object={material} attach='material' />
    </mesh>
  );
}
