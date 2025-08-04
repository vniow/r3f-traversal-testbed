import { Line } from "@react-three/drei";

const TRIANGLE_POINTS: [number, number, number][] = [
  [0, 0, 0],    // Vertex 1 (Red)
  [1, 0, 0],    // Vertex 2 (Green)
  [0.5, 1, 0],  // Vertex 3 (Blue)
  [0, 0, 0],    // Close the triangle (Red)
];

const COLORS: [number, number, number][] = [
  [1, 0, 0], // Red
  [0, 1, 0], // Green
  [0, 0, 1], // Blue
  [1, 0, 0], // Red (to close)
];

export default function Triangle() {
  return (
    <Line
      points={TRIANGLE_POINTS as [number, number, number][]}
      vertexColors={COLORS as [number, number, number][]}
      lineWidth={2}
    />
  );
}
