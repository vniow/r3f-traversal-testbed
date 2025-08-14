import { Line } from "@react-three/drei";
import type { ObjectWithVertices } from "./vertexUtils";

interface DynamicPolygonProps {
  object: ObjectWithVertices;
}

export function DynamicPolygon({ object }: DynamicPolygonProps) {
  return <Line points={object.points} vertexColors={object.colors} lineWidth={2} />;
}
