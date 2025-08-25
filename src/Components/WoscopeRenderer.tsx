import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { woscopeVertexShader, woscopeFragmentShader, woscopeShaderUniforms } from '../shaders/woscopeShaders';
import { createVertexDataFromAudio, type WoscopeConfig, defaultWoscopeConfig } from '../utils/woscopeVertexUtils';

interface WoscopeRendererProps {
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  sampleRate: number;
  audioElement?: HTMLAudioElement | null;
  analyserPull?: () => { left: Float32Array; right: Float32Array };
  snapshot?: {
    vertices: Float32Array;
    indices: Uint16Array;
    numSegments: number;
  } | null;
  config?: Partial<WoscopeConfig>;
}

export function WoscopeRenderer({
  leftChannel,
  rightChannel,
  isPlaying,
  currentTime,
  duration: _duration,
  sampleRate,
  audioElement,
  analyserPull,
  snapshot,
  config = {},
}: WoscopeRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Preallocated buffers to avoid per-frame allocations
  // Interleaved vertex buffer backing array and index buffer
  // Vertex layout: [aStart.x,aStart.y,aEnd.x,aEnd.y,aIdx] (5 floats per vertex)
  const interleavedBufRef = useRef<Float32Array | null>(null);
  const indexBufRef = useRef<Uint16Array | null>(null);

  // Merge configuration with defaults
  const woscopeConfig = useMemo(
    () => ({
      ...defaultWoscopeConfig,
      ...config,
    }),
    [config]
  );

  // Create shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uInvert: { value: woscopeShaderUniforms.uInvert.value },
        uSize: { value: woscopeShaderUniforms.uSize.value },
        uIntensity: { value: woscopeShaderUniforms.uIntensity.value },
        uColor: { value: new THREE.Vector4(...(woscopeShaderUniforms.uColor.value as number[])) },
        uN: { value: woscopeShaderUniforms.uN.value },
      },
      vertexShader: woscopeVertexShader,
      fragmentShader: woscopeFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Update geometry and uniforms each frame
  useFrame(() => {
    if (!meshRef.current || !geometryRef.current || !materialRef.current) return;
    if (leftChannel.length === 0 || rightChannel.length === 0) return;

    // Calculate current sample position
    let startSample = 0;

    const geometry = geometryRef.current;

    // Ensure preallocated buffers and attributes exist (based on woscopeConfig.nSamples)
    const maxSegments = Math.max(1, (woscopeConfig.nSamples || 1024) - 1);
    const maxVertices = maxSegments * 4;
    const vertexStride = 5; // floats per vertex in interleaved layout
    // helper: compute normalized intensity based on draw count vs expected
    const computeNormalizedIntensity = (drawIndices: number) => {
      const expectedIndices = Math.max(1, ((woscopeConfig.nSamples || 1024) - 1) * 6);
      // scale by sqrt to reduce sensitivity, clamp to reasonable range
      const scale = Math.sqrt(expectedIndices / Math.max(1, drawIndices));
      const clamped = Math.max(0.5, Math.min(2.0, scale));
      return clamped; // base intensity = 1.0 * clamped
    };

    if (!geometry.getAttribute('aStart')) {
      // allocate backing arrays once
      interleavedBufRef.current = new Float32Array(maxVertices * vertexStride);
      indexBufRef.current = new Uint16Array(maxSegments * 6);

      // Create an InterleavedBuffer and InterleavedBufferAttributes to map into the interleaved layout
      const interleaved = new THREE.InterleavedBuffer(interleavedBufRef.current, vertexStride);
      geometry.setAttribute('aStart', new THREE.InterleavedBufferAttribute(interleaved, 2, 0)); // offset 0
      geometry.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(interleaved, 2, 2)); // offset 2
      geometry.setAttribute('aIdx', new THREE.InterleavedBufferAttribute(interleaved, 1, 4)); // offset 4
      geometry.setIndex(new THREE.BufferAttribute(indexBufRef.current, 1));
    }

    // If a frozen snapshot exists and playback is paused, render the snapshot and return
    if (!isPlaying && typeof snapshot !== 'undefined' && snapshot !== null) {
      if (snapshot.numSegments === 0) return;
      // snapshot.vertices previously contained interleaved format used by old code; if snapshot was captured by the new interleaved generator
      // it should already match the new layout. We'll copy into the interleaved backing buffer.
      const snapshotVertices = snapshot.vertices;
      const vertexCount = snapshotVertices.length / 5; // if older snapshots exist, fallback heuristics would be needed
      const interleaved = interleavedBufRef.current!;
      const idxBuf = indexBufRef.current!;

      // If snapshot vertices appear to be in the old 4-float format, we try best-effort conversion
      if (snapshotVertices.length === vertexCount * 4) {
        // old format [x,y,quadIndex,segmentT] -> convert to [aStart.x,aStart.y,aEnd.x,aEnd.y,aIdx]
        for (let v = 0; v < vertexCount; v++) {
          const srcBase = v * 4;
          const dstBase = v * vertexStride;
          const x = snapshotVertices[srcBase + 0];
          const y = snapshotVertices[srcBase + 1];
          // degenerate aEnd = aStart for lack of neighbor info
          interleaved[dstBase + 0] = x;
          interleaved[dstBase + 1] = y;
          interleaved[dstBase + 2] = x;
          interleaved[dstBase + 3] = y;
          interleaved[dstBase + 4] = v;
        }
      } else {
        // assume snapshot is already in the new interleaved format
        interleaved.set(snapshotVertices.subarray(0, vertexCount * vertexStride));
      }

      idxBuf.set(snapshot.indices.subarray(0, snapshot.indices.length));

      const aStartAttr = geometry.getAttribute('aStart') as THREE.InterleavedBufferAttribute;
      // const aEndAttr = geometry.getAttribute('aEnd') as THREE.InterleavedBufferAttribute;
      // const aIdxAttr = geometry.getAttribute('aIdx') as THREE.InterleavedBufferAttribute;
      const idxAttr = geometry.index as THREE.BufferAttribute;

      // mark interleaved buffer as needing update
      (aStartAttr.data as THREE.InterleavedBuffer).needsUpdate = true;
      idxAttr.needsUpdate = true;

      geometry.setDrawRange(0, snapshot.indices.length);
      materialRef.current!.uniforms.uIntensity.value = computeNormalizedIntensity(snapshot.indices.length);
      return;
    }

    // If an analyser pull is provided, prefer live analyser samples for visual fidelity
    if (analyserPull) {
      const { left: liveLeft, right: liveRight } = analyserPull();
      if (liveLeft && liveLeft.length > 0) {
        const vertexData = createVertexDataFromAudio(liveLeft, liveRight, 0, woscopeConfig);
        if (vertexData.numSegments === 0) return;

        const actualVertices = vertexData.vertices.length / vertexStride;
        const interleaved = interleavedBufRef.current!;
        const idxBuf = indexBufRef.current!;

        // copy interleaved vertex data directly into our backing buffer
        interleaved.set(vertexData.vertices.subarray(0, actualVertices * vertexStride));
        idxBuf.set(vertexData.indices.subarray(0, vertexData.indices.length));

        const aStartAttr = geometry.getAttribute('aStart') as THREE.InterleavedBufferAttribute;
        const idxAttr = geometry.index as THREE.BufferAttribute;

        (aStartAttr.data as THREE.InterleavedBuffer).needsUpdate = true;
        idxAttr.needsUpdate = true;

        geometry.setDrawRange(0, vertexData.indices.length);
        materialRef.current!.uniforms.uIntensity.value = computeNormalizedIntensity(vertexData.indices.length);
        return;
      }
    }

    // Fallback: compute start sample from audioElement.currentTime (per-frame) or React state
    const playTime = (audioElement && audioElement.currentTime) ?? currentTime;
    const clampedPlayTime = typeof _duration === 'number' ? Math.min(playTime, _duration) : playTime;
    startSample = Math.floor(clampedPlayTime * sampleRate);

    // Debug logging (remove after testing)
    // if (Math.floor(currentTime) !== Math.floor(currentTime - 1/60)) {
    //   console.log('[WoscopeRenderer] timeProgress:', timeProgress.toFixed(3), 'startSample:', startSample, 'isPlaying:', isPlaying);
    // }

    // Generate vertex data for current audio window (fallback decoded-buffer path)
    const vertexData = createVertexDataFromAudio(leftChannel, rightChannel, startSample, woscopeConfig);
    if (vertexData.numSegments === 0) return;

    const actualVertices = vertexData.vertices.length / vertexStride;
    const interleaved = interleavedBufRef.current!;
    const idxBuf = indexBufRef.current!;

    interleaved.set(vertexData.vertices.subarray(0, actualVertices * vertexStride));
    idxBuf.set(vertexData.indices.subarray(0, vertexData.indices.length));

    const aStartAttr = geometry.getAttribute('aStart') as THREE.InterleavedBufferAttribute;
    const idxAttr = geometry.index as THREE.BufferAttribute;

    (aStartAttr.data as THREE.InterleavedBuffer).needsUpdate = true;
    idxAttr.needsUpdate = true;

    geometry.setDrawRange(0, vertexData.indices.length);

    // Update material uniforms
    const material = materialRef.current;
    material.uniforms.uIntensity.value = computeNormalizedIntensity(vertexData.indices.length);
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial ref={materialRef} attach='material' {...shaderMaterial} />
    </mesh>
  );
}
