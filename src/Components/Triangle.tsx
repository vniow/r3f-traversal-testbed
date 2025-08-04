


import { Line } from "@react-three/drei";
import { TRIANGLE_POINTS, TRIANGLE_COLORS } from "./trianglePoints";


export default function Triangle() {
  return (
    <Line
      points={TRIANGLE_POINTS}
      vertexColors={TRIANGLE_COLORS}
      lineWidth={2}
    />
  );
}