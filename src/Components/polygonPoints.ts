export const POLYGON_POINTS: [number, number, number][] = [
  [-0.5, -2.5, 0],   // Bottom left
  [0.5, -2.5, 0],    // Bottom right
  [1, -1.5, 0],      // Right
  [0, -0.5, 0],       // Top
  [-1, -1.5, 0],     // Left
  [-0.5, -2.5, 0],   // Close the polygon
];

export const POLYGON_COLORS: [number, number, number][] = [
  [1, 0, 0], // Red
  [0, 1, 0], // Green
  [0, 0, 1], // Blue
  [1, 0, 0], // Red
  [0, 1, 0], // Green
  [1, 0, 0], // Red (to close)
];
