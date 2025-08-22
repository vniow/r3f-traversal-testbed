/**
 * Woscope beam shaders for React Three Fiber
 * Ported from woscope's vsLine.glsl and fsLine.glsl for analytical Gaussian beam rendering
 */

export const woscopeVertexShader = `
uniform float uSize;
uniform vec2 uResolution;

// Custom attributes from our vertex data
attribute float quadIndex;
attribute float segmentT;

varying vec2 vUv;
varying float vIntensity;
varying float vSegmentLength;

void main() {
  // position.xy contains the actual oscilloscope coordinates
  vec2 oscopePos = position.xy;
  
  // Calculate perpendicular offset for beam width
  // quadIndex determines which corner of the quad we're rendering
  float perpOffset = (mod(quadIndex, 2.0) == 0.0) ? -uSize : uSize;
  
  // For beam rendering, we need to expand perpendicular to the line direction
  // This is a simplified approach - in a full implementation, we'd calculate
  // the line direction from adjacent vertices
  vec2 perpDir = vec2(0.0, 1.0); // simplified: always expand vertically
  
  // Apply perpendicular offset
  vec2 finalPos = oscopePos + perpDir * perpOffset;
  
  // Pass data to fragment shader
  vUv = vec2(segmentT, perpOffset / uSize); // u = along segment, v = across beam
  vIntensity = 1.0;
  vSegmentLength = 1.0; // simplified for now
  
  // Convert to clip space (R3F handles modelViewMatrix and projectionMatrix)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 0.0, 1.0);
}
`;

export const woscopeFragmentShader = `
uniform float uSize;
uniform float uIntensity;
uniform vec3 uColor;
uniform vec2 uResolution;

varying vec2 vUv;
varying float vIntensity;
varying float vSegmentLength;

void main() {
  // Distance from center of beam (analytical Gaussian profile)
  float distFromCenter = abs(vUv.y);
  
  // Gaussian falloff for beam intensity
  float sigma = 0.3; // controls beam width
  float gaussianFalloff = exp(-(distFromCenter * distFromCenter) / (2.0 * sigma * sigma));
  
  // Handle very short segments to avoid numerical issues
  float segmentIntensity = vSegmentLength > 0.001 ? 1.0 : vSegmentLength / 0.001;
  
  // Combine intensity factors
  float finalIntensity = gaussianFalloff * uIntensity * vIntensity * segmentIntensity;
  
  // Apply color with intensity
  vec3 finalColor = uColor * finalIntensity;
  
  // Output with alpha for blending
  gl_FragColor = vec4(finalColor, finalIntensity);
}
`;

export const woscopeShaderUniforms = {
  uSize: { value: 0.02 },
  uIntensity: { value: 1.0 },
  uColor: { value: [0.0, 1.0, 0.0] }, // classic green oscilloscope color
  uResolution: { value: [1024, 1024] },
};