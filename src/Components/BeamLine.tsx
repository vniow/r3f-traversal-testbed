import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Color } from "three";

/**
 * BeamLine: custom shader-driven line emulating CRT/oscilloscope beam with per-vertex intensity.
 * Intensity below blankThreshold discards fragments (true blanking) instead of merely darkening.
 */
export interface BeamLineProps {
  points: [number, number, number][];
  colors: Color[];
  intensities: number[]; // 0..1 per vertex
  blankThreshold?: number; // discard below
  gamma?: number; // gamma correction applied to intensity (display shaping)
}

const vertexShader = /* glsl */ `
  attribute vec3 color;
  attribute float intensity;
  varying vec3 vColor;
  varying float vI;
  void main() {
    vColor = color;
    vI = intensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vI;
  uniform float uBlankThreshold;
  uniform float uGamma; // display gamma; shader converts intensity via pow(i, 1.0 / gamma)
  void main() {
    if (vI < uBlankThreshold) discard; // Hard blanking
    float i = pow(clamp(vI, 0.0, 1.0), 1.0 / max(uGamma, 0.0001));
    gl_FragColor = vec4(vColor * i, i); // Alpha = intensity for potential post-effects
  }
`;

export function BeamLine({ points, colors, intensities, blankThreshold = 0.02, gamma = 2.2 }: BeamLineProps) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const lineRef = useRef<THREE.Line | null>(null);

  // Build geometry when inputs change
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = Math.min(points.length, colors.length, intensities.length);
    const positions = new Float32Array(count * 3);
    const colorArr = new Float32Array(count * 3);
    const intensityArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = points[i];
      positions[i * 3 + 0] = p[0];
      positions[i * 3 + 1] = p[1];
      positions[i * 3 + 2] = p[2];
      const c = colors[i];
      colorArr[i * 3 + 0] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
      intensityArr[i] = intensities[i];
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
    geo.setAttribute("intensity", new THREE.BufferAttribute(intensityArr, 1));
    return geo;
  }, [points, colors, intensities]);

  useEffect(() => {
    geometryRef.current = geometry;
    return () => geometry.dispose();
  }, [geometry]);

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBlankThreshold: { value: blankThreshold },
        uGamma: { value: gamma },
      },
    });
    materialRef.current = mat;
    return mat;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update uniforms when props change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uBlankThreshold.value = blankThreshold;
      materialRef.current.uniforms.uGamma.value = gamma;
    }
  }, [blankThreshold, gamma]);

  // Build a THREE.Line instance lazily
  const line = useMemo(() => {
    return new THREE.Line(geometry, material);
  }, [geometry, material]);

  useEffect(() => {
    lineRef.current = line;
  }, [line]);

  return <primitive object={line} />;
}
