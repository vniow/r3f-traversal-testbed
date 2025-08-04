import { Line } from "@react-three/drei";
import { SQUARE_POINTS, SQUARE_COLORS } from "./squarePoints";



export default function Square() {
  return (
    <Line
      points={SQUARE_POINTS}
      vertexColors={SQUARE_COLORS}
      lineWidth={2}
    />
  );

}
