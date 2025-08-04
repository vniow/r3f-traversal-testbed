import { Line } from "@react-three/drei";
import { POLYGON_POINTS, POLYGON_COLORS } from "./polygonPoints";

export default function Polygon() {
  return (
    <Line
      points={POLYGON_POINTS}
      vertexColors={POLYGON_COLORS}
      lineWidth={2}
    />
  );
}
