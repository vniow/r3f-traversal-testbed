import { Line } from "@react-three/drei";

// Square vertices (closed loop), offset to the left of the triangle
const SQUARE_POINTS: [number, number, number][] = [
  [-1.5, -0.5, 0],   // Bottom left
  [-0.5, -0.5, 0],   // Bottom right
  [-0.5, 0.5, 0],   // Top right
  [-1.5, 0.5, 0],   // Top left
  [-1.5, -0.5, 0],   // Close the square
];

// Assign a color to each vertex (optional: all white, or you can use different colors)
const COLORS: [number, number, number][] = [
  [1, 0, 0], // Red
  [0, 1, 0], // Green
  [0, 0, 1], // Blue
  [1, 0, 0], // Red (to close)
    [1, 0, 0], // Red (to close)
];

export default function Square() {
  return (
    <Line
      points={SQUARE_POINTS}
      vertexColors={COLORS}
      lineWidth={2}
    />
  );
}
