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
  const positionsBufRef = useRef<Float32Array | null>(null);
  const quadIndexBufRef = useRef<Float32Array | null>(null);
  const segmentTBufRef = useRef<Float32Array | null>(null);
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
        uSize: { value: woscopeShaderUniforms.uSize.value },
        uIntensity: { value: woscopeShaderUniforms.uIntensity.value },
        uColor: { value: new THREE.Vector3(...woscopeShaderUniforms.uColor.value) },
        uResolution: { value: new THREE.Vector2(...woscopeShaderUniforms.uResolution.value) },
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

    if (!geometry.getAttribute('position')) {
      // allocate backing arrays once
      positionsBufRef.current = new Float32Array(maxVertices * 3);
      quadIndexBufRef.current = new Float32Array(maxVertices);
      segmentTBufRef.current = new Float32Array(maxVertices);
      indexBufRef.current = new Uint16Array(maxSegments * 6);

      geometry.setAttribute('position', new THREE.BufferAttribute(positionsBufRef.current, 3));
      geometry.setAttribute('quadIndex', new THREE.BufferAttribute(quadIndexBufRef.current, 1));
      geometry.setAttribute('segmentT', new THREE.BufferAttribute(segmentTBufRef.current, 1));
      geometry.setIndex(new THREE.BufferAttribute(indexBufRef.current, 1));
    }

    // If a frozen snapshot exists and playback is paused, render the snapshot and return
    if (!isPlaying && typeof snapshot !== 'undefined' && snapshot !== null) {
      if (snapshot.numSegments === 0) return;

      const actualVertices = snapshot.vertices.length / 4;
      const posBuf = positionsBufRef.current!;
      const quadBuf = quadIndexBufRef.current!;
      const segTBuf = segmentTBufRef.current!;
      const idxBuf = indexBufRef.current!;

      for (let i = 0; i < actualVertices; i++) {
        const baseIndex = i * 4;
        const posIndex = i * 3;
        posBuf[posIndex] = snapshot.vertices[baseIndex];
        posBuf[posIndex + 1] = snapshot.vertices[baseIndex + 1];
        posBuf[posIndex + 2] = 0;
        quadBuf[i] = snapshot.vertices[baseIndex + 2];
        segTBuf[i] = snapshot.vertices[baseIndex + 3];
      }

      idxBuf.set(snapshot.indices.subarray(0, snapshot.indices.length));

      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const quadAttr = geometry.getAttribute('quadIndex') as THREE.BufferAttribute;
      const segTAttr = geometry.getAttribute('segmentT') as THREE.BufferAttribute;
      const idxAttr = geometry.index as THREE.BufferAttribute;

      posAttr.needsUpdate = true;
      quadAttr.needsUpdate = true;
      segTAttr.needsUpdate = true;
      idxAttr.needsUpdate = true;

      geometry.setDrawRange(0, snapshot.indices.length);
      // render snapshot at full intensity (do not dim on pause)
      materialRef.current!.uniforms.uIntensity.value = 1.0;
      return;
    }

    // If an analyser pull is provided, prefer live analyser samples for visual fidelity
    if (analyserPull) {
      const { left: liveLeft, right: liveRight } = analyserPull();
      if (liveLeft && liveLeft.length > 0) {
        const vertexData = createVertexDataFromAudio(liveLeft, liveRight, 0, woscopeConfig);
        if (vertexData.numSegments === 0) return;

        // Write into preallocated buffers
        const actualVertices = vertexData.vertices.length / 4;
        const posBuf = positionsBufRef.current!;
        const quadBuf = quadIndexBufRef.current!;
        const segTBuf = segmentTBufRef.current!;
        const idxBuf = indexBufRef.current!;

        for (let i = 0; i < actualVertices; i++) {
          const baseIndex = i * 4;
          const posIndex = i * 3;
          posBuf[posIndex] = vertexData.vertices[baseIndex];
          posBuf[posIndex + 1] = vertexData.vertices[baseIndex + 1];
          posBuf[posIndex + 2] = 0;
          quadBuf[i] = vertexData.vertices[baseIndex + 2];
          segTBuf[i] = vertexData.vertices[baseIndex + 3];
        }

        // copy indices
        idxBuf.set(vertexData.indices.subarray(0, vertexData.indices.length));

        // Update attributes and draw range
        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
        const quadAttr = geometry.getAttribute('quadIndex') as THREE.BufferAttribute;
        const segTAttr = geometry.getAttribute('segmentT') as THREE.BufferAttribute;
        const idxAttr = geometry.index as THREE.BufferAttribute;

        posAttr.needsUpdate = true;
        quadAttr.needsUpdate = true;
        segTAttr.needsUpdate = true;
        idxAttr.needsUpdate = true;

        geometry.setDrawRange(0, vertexData.indices.length);
        // Keep intensity at full brightness even when paused/snapshot so visuals don't dim
        materialRef.current!.uniforms.uIntensity.value = 1.0;
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

    // Generate vertex data for current audio window
    const vertexData = createVertexDataFromAudio(leftChannel, rightChannel, startSample, woscopeConfig);

    if (vertexData.numSegments === 0) return;

    // Update geometry with new vertex data into preallocated buffers
    const actualVertices = vertexData.vertices.length / 4;
    const posBuf = positionsBufRef.current!;
    const quadBuf = quadIndexBufRef.current!;
    const segTBuf = segmentTBufRef.current!;
    const idxBuf = indexBufRef.current!;

    for (let i = 0; i < actualVertices; i++) {
      const baseIndex = i * 4;
      const posIndex = i * 3;
      posBuf[posIndex] = vertexData.vertices[baseIndex];
      posBuf[posIndex + 1] = vertexData.vertices[baseIndex + 1];
      posBuf[posIndex + 2] = 0;
      quadBuf[i] = vertexData.vertices[baseIndex + 2];
      segTBuf[i] = vertexData.vertices[baseIndex + 3];
    }

    idxBuf.set(vertexData.indices.subarray(0, vertexData.indices.length));

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const quadAttr = geometry.getAttribute('quadIndex') as THREE.BufferAttribute;
    const segTAttr = geometry.getAttribute('segmentT') as THREE.BufferAttribute;
    const idxAttr = geometry.index as THREE.BufferAttribute;

    posAttr.needsUpdate = true;
    quadAttr.needsUpdate = true;
    segTAttr.needsUpdate = true;
    idxAttr.needsUpdate = true;

    geometry.setDrawRange(0, vertexData.indices.length);

    // Update material uniforms
    const material = materialRef.current;
    material.uniforms.uIntensity.value = isPlaying ? 1.0 : 0.5;
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial ref={materialRef} attach='material' {...shaderMaterial} />
    </mesh>
  );
}
