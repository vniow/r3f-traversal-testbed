/**
 * Woscope beam shaders adapted from upstream vsLine.glsl and fsLine.glsl
 * - Vertex shader expects attributes: aStart(vec2), aEnd(vec2), aIdx(float)
 * - Fragment shader implements analytic Gaussian integration (erf) used by upstream
 */

export const woscopeVertexShader = `
precision highp float;
#define EPS 1E-6
uniform float uInvert;
uniform float uSize;
attribute vec2 aStart;
attribute vec2 aEnd;
attribute float aIdx;
varying vec4 uvl;

void main() {
  float tang;
  vec2 current;
  float idx = mod(aIdx, 4.0);
  if (idx >= 2.0) {
    current = aEnd;
    tang = 1.0;
  } else {
    current = aStart;
    tang = -1.0;
  }
  float side = (mod(idx, 2.0) - 0.5) * 2.0;
  uvl.xy = vec2(tang, side);
  uvl.w = floor(aIdx / 4.0 + 0.5);

  vec2 dir = aEnd - aStart;
  uvl.z = length(dir);
  if (uvl.z > EPS) {
    dir = dir / uvl.z;
  } else {
    dir = vec2(1.0, 0.0);
  }
  vec2 norm = vec2(-dir.y, dir.x);
  vec2 pos = (current + (tang * dir + norm * side) * uSize) * uInvert;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
}
`;

export const woscopeFragmentShader = `
precision highp float;
#define EPS 1E-6
#define TAU 6.283185307179586
#define TAUR 2.5066282746310002
#define SQRT2 1.4142135623730951
uniform float uSize;
uniform float uIntensity;
uniform vec4 uColor;
uniform float uN; // used for afterglow scaling
varying vec4 uvl;

float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma)) / (TAUR * sigma);
}

float erf(float x) {
  float s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  x *= x;
  return s - s / (x * x);
}

void main (void)
{
  float len = uvl.z;
  vec2 uvl_xy = uvl.xy;
  vec2 xy = vec2((len/2.0 + uSize) * uvl_xy.x + len/2.0, uSize * uvl_xy.y);
  float alpha;

  float sigma = uSize / 4.0;
  if (len < EPS) {
    alpha = exp(-pow(length(xy), 2.0) / (2.0 * sigma * sigma)) / 2.0 / sqrt(uSize);
  } else {
    alpha = erf((len - xy.x) / SQRT2 / sigma) + erf(xy.x / SQRT2 / sigma);
    alpha *= exp(-xy.y * xy.y / (2.0 * sigma * sigma)) / 2.0 / len * uSize;
  }
  float afterglow = smoothstep(0.0, 0.33, uvl.w / max(1.0, uN));
  alpha *= afterglow * uIntensity;
  gl_FragColor = vec4(vec3(uColor.xyz), uColor.w * alpha);
}
`;

export const woscopeShaderUniforms = {
  uInvert: { value: 1.0 },
  uSize: { value: 0.012 },
  uIntensity: { value: 1.0 },
  uColor: { value: [0.0, 1.0, 0.0, 1.0] },
  uN: { value: 2048 },
};
