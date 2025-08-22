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
  config?: Partial<WoscopeConfig>;
}

export function WoscopeRenderer({
  leftChannel,
  rightChannel,
  isPlaying,
  currentTime,
  duration,
  // sampleRate, // TODO: use for time-accurate sample positioning
  config = {},
}: WoscopeRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Merge configuration with defaults
  const woscopeConfig = useMemo(() => ({
    ...defaultWoscopeConfig,
    ...config,
  }), [config]);

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
    const timeProgress = duration > 0 ? currentTime / duration : 0;
    const totalSamples = leftChannel.length;
    const startSample = Math.floor(timeProgress * totalSamples);
    
    // Debug logging (remove after testing)
    if (Math.floor(currentTime) !== Math.floor(currentTime - 1/60)) {
      console.log('[WoscopeRenderer] timeProgress:', timeProgress.toFixed(3), 'startSample:', startSample, 'isPlaying:', isPlaying);
    }
    
    // Generate vertex data for current audio window
    const vertexData = createVertexDataFromAudio(
      leftChannel,
      rightChannel,
      startSample,
      woscopeConfig
    );

    if (vertexData.numSegments === 0) return;

    // Update geometry with new vertex data
    const geometry = geometryRef.current;
    
    // Set positions (x, y from vertex data)
    const positions = new Float32Array(vertexData.vertices.length / 4 * 3);
    const quadIndices = new Float32Array(vertexData.vertices.length / 4);
    const segmentTs = new Float32Array(vertexData.vertices.length / 4);
    
    for (let i = 0; i < vertexData.vertices.length / 4; i++) {
      const baseIndex = i * 4;
      const posIndex = i * 3;
      
      // Extract position
      positions[posIndex] = vertexData.vertices[baseIndex]; // x
      positions[posIndex + 1] = vertexData.vertices[baseIndex + 1]; // y
      positions[posIndex + 2] = 0; // z
      
      // Extract attributes
      quadIndices[i] = vertexData.vertices[baseIndex + 2];
      segmentTs[i] = vertexData.vertices[baseIndex + 3];
    }
    
    // Update buffer attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('quadIndex', new THREE.BufferAttribute(quadIndices, 1));
    geometry.setAttribute('segmentT', new THREE.BufferAttribute(segmentTs, 1));
    geometry.setIndex(new THREE.BufferAttribute(vertexData.indices, 1));
    
    // Mark attributes as needing update
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.quadIndex.needsUpdate = true;
    geometry.attributes.segmentT.needsUpdate = true;
    geometry.index!.needsUpdate = true;

    // Update material uniforms
    const material = materialRef.current;
    material.uniforms.uIntensity.value = isPlaying ? 1.0 : 0.5;
  });

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        ref={materialRef}
        attach="material"
        {...shaderMaterial}
      />
    </mesh>
  );
}