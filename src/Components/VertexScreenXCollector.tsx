import { useThree, useFrame } from "@react-three/fiber";
import type { ObjectWithVertices } from "./vertexUtils";
import { collectVertexScreenData } from "./vertexScreenUtils";

export function VertexScreenXCollector({
  objects,
  setVertexData,
}: {
  objects: ObjectWithVertices[];
  setVertexData: (data: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source: ("object" | "interpolated")[];
  }) => void;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const { data, source } = collectVertexScreenData(objects, camera);

    // Extract all values into separate arrays
    const vertexData = {
      screenX: data.map(d => d.screenX),
      screenY: data.map(d => d.screenY),
      screenZ: data.map(d => d.screenZ),
      r: data.map(d => d.r),
      g: data.map(d => d.g),
      b: data.map(d => d.b),
      source,
    };

    setVertexData(vertexData);
  });

  return null;
}
