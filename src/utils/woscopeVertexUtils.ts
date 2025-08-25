/**
 * Woscope vertex data utilities for converting audio samples into WebGL geometry
 * Based on woscope's loadChannelsInto pattern for creating oscilloscope visualizations
 */

export interface WoscopeVertexData {
  /** Interleaved vertex buffer: [aStart.x,aStart.y,aEnd.x,aEnd.y,aIdx] per vertex */
  vertices: Float32Array;
  indices: Uint16Array;
  numSegments: number;
}

export interface WoscopeConfig {
  nSamples: number;
  timeScale: number;
  amplitudeScale: number;
  sweep: boolean;
  swap: boolean;
}

/**
 * Convert stereo audio samples into interleaved vertex data for quad-based beam rendering
 * Follows woscope's pattern: each sample becomes a line segment rendered as a quad
 */
export function createVertexDataFromAudio(
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  startSample: number,
  config: WoscopeConfig
): WoscopeVertexData {
  const { nSamples, timeScale, amplitudeScale, sweep, swap } = config;

  // Clamp to available samples
  const actualSamples = Math.min(nSamples, leftChannel.length - startSample);
  const numSegments = actualSamples - 1; // N samples = N-1 line segments

  if (numSegments <= 0) {
    return {
      vertices: new Float32Array(0),
      indices: new Uint16Array(0),
      numSegments: 0,
    };
  }

  // Each segment needs 4 vertices (2 endpoints × 2 for quad expansion)
  // Vertex format (interleaved): [aStart.x, aStart.y, aEnd.x, aEnd.y, aIdx]
  // - aStart: start point of the segment
  // - aEnd: end point of the segment
  // - aIdx: integer-like float: segmentIndex*4 + quadCorner (0..3)
  const vertexData = new Float32Array(numSegments * 4 * 5);

  // Generate vertices for each line segment
  let vertexIndex = 0;

  for (let i = 0; i < numSegments; i++) {
    const sampleIndex = startSample + i;

    // Get current and next sample
    const x1 = swap ? rightChannel[sampleIndex] : leftChannel[sampleIndex];
    const y1 = swap ? leftChannel[sampleIndex] : rightChannel[sampleIndex];
    const x2 = swap ? rightChannel[sampleIndex + 1] : leftChannel[sampleIndex + 1];
    const y2 = swap ? leftChannel[sampleIndex + 1] : rightChannel[sampleIndex + 1];

    // Apply scaling
    const scaledX1 = x1 * amplitudeScale;
    const scaledY1 = y1 * amplitudeScale;
    const scaledX2 = x2 * amplitudeScale;
    const scaledY2 = y2 * amplitudeScale;

    // Time progression (for sweep mode or time-based visualization)
    const t1 = sweep ? (i / (numSegments - 1)) * timeScale : scaledX1;
    const t2 = sweep ? ((i + 1) / (numSegments - 1)) * timeScale : scaledX2;

    // Create 4 vertices for this segment (quad corners)
    // For each vertex we emit: aStart.x, aStart.y, aEnd.x, aEnd.y, aIdx
    const baseIdx = i * 4;
    // quad corner 0
    vertexData[vertexIndex++] = t1; // aStart.x
    vertexData[vertexIndex++] = scaledY1; // aStart.y
    vertexData[vertexIndex++] = t2; // aEnd.x
    vertexData[vertexIndex++] = scaledY2; // aEnd.y
    vertexData[vertexIndex++] = baseIdx + 0; // aIdx

    // quad corner 1
    vertexData[vertexIndex++] = t1;
    vertexData[vertexIndex++] = scaledY1;
    vertexData[vertexIndex++] = t2;
    vertexData[vertexIndex++] = scaledY2;
    vertexData[vertexIndex++] = baseIdx + 1;

    // quad corner 2
    vertexData[vertexIndex++] = t1;
    vertexData[vertexIndex++] = scaledY1;
    vertexData[vertexIndex++] = t2;
    vertexData[vertexIndex++] = scaledY2;
    vertexData[vertexIndex++] = baseIdx + 2;

    // quad corner 3
    vertexData[vertexIndex++] = t1;
    vertexData[vertexIndex++] = scaledY1;
    vertexData[vertexIndex++] = t2;
    vertexData[vertexIndex++] = scaledY2;
    vertexData[vertexIndex++] = baseIdx + 3;
  }

  // Generate indices for triangles (2 triangles per quad)
  const indices = new Uint16Array(numSegments * 6);
  let indexOffset = 0;

  for (let i = 0; i < numSegments; i++) {
    const baseVertex = i * 4;

    // Triangle 1: 0, 1, 2
    indices[indexOffset++] = baseVertex + 0;
    indices[indexOffset++] = baseVertex + 1;
    indices[indexOffset++] = baseVertex + 2;

    // Triangle 2: 1, 2, 3
    indices[indexOffset++] = baseVertex + 1;
    indices[indexOffset++] = baseVertex + 2;
    indices[indexOffset++] = baseVertex + 3;
  }

  return {
    vertices: vertexData,
    indices,
    numSegments,
  };
}

/**
 * Default woscope configuration for oscilloscope-style visualization
 */
export const defaultWoscopeConfig: WoscopeConfig = {
  nSamples: 1024,
  timeScale: 2.0,
  amplitudeScale: 1.0,
  sweep: false, // XY mode by default (left=X, right=Y)
  swap: false, // don't swap left/right channels
};

/**
 * Helper to create time-domain sweep visualization (like traditional oscilloscope)
 */
export function createSweepConfig(overrides: Partial<WoscopeConfig> = {}): WoscopeConfig {
  return {
    ...defaultWoscopeConfig,
    sweep: true,
    timeScale: 4.0, // spread across wider time range
    ...overrides,
  };
}

/**
 * Helper to create XY mode visualization (Lissajous patterns)
 */
export function createXYConfig(overrides: Partial<WoscopeConfig> = {}): WoscopeConfig {
  return {
    ...defaultWoscopeConfig,
    sweep: false,
    amplitudeScale: 1.5, // boost amplitude for better visibility
    ...overrides,
  };
}
