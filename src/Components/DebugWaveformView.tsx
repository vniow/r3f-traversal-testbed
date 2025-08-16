/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { DebugAudioEngine } from "./DebugAudioEngine";

type Props = {
  engine: DebugAudioEngine;
  channel?: number;
  windowSize?: number; // number of samples to display
  amplitude?: number; // vertical scale
  timeScale?: number; // normalized width scaling
};

export default function DebugWaveformView({ engine, channel = 0, windowSize = 2048, amplitude = 0.9 }: Props) {
  // stable points array (Vector3) to avoid per-frame allocations
  const points = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < windowSize; i++) {
      const x = (i / (windowSize - 1)) * 2 - 1; // -1..1
      arr.push(new THREE.Vector3(x, 0, 0));
    }
    return arr;
  }, [windowSize]);

  const sampleBuf = useMemo(() => new Float32Array(windowSize), [windowSize]);
  const lineRef = useRef<any>(null);

  useFrame(() => {
    const g = lineRef.current;
    if (!g) return;
    // compute endSample accounting for output latency
    const sampleRate = engine.sampleRate || 48000;
    const baseLatency = engine.context?.baseLatency ?? 0.02;
    const latencySamples = Math.max(0, Math.round((baseLatency || 0.02) * sampleRate) + 32);
    const write = engine.getWriteIndex();
    const endSample = write - latencySamples - 1;
    const got = engine.getSamplesForChannel(channel, endSample, sampleBuf);

    // update point y values
    for (let i = 0; i < got; i++) {
      points[i].y = sampleBuf[i] * amplitude;
    }
    for (let i = got; i < windowSize; i++) points[i].y = 0;

    // update geometry from points without allocating
    try {
      const geom = g.geometry as THREE.BufferGeometry;
      geom.setFromPoints(points);
      if (geom.attributes && (geom.attributes as any).position) (geom.attributes as any).position.needsUpdate = true;
    } catch {
      // ignore
    }
  });

  return <Line ref={lineRef} points={points} frustumCulled={false} lineWidth={1} color='#0ff' toneMapped={false} />;
}
