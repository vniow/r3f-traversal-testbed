import { View, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { Color } from "three";
import Triangle from "./Triangle";
import Square from "./Square";
import { useLogVertices } from "./vertexUtils";
import { InterpolatedPoints } from "./useLogVertices";
import type { ObjectWithVertices } from "./vertexUtils";
import Polygon from "./Polygon";
import Lights from "./Lights";
import { VertexScreenXCollector } from "./VertexScreenXCollector";

interface SceneViewProps {
  objects: ObjectWithVertices[];
  setVertexData: (data: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source?: ("object" | "interpolated")[];
  }) => void;
}

function SceneBackground() {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.background = new Color("#333333");
  }, [scene]);
  return null;
}

function SceneWithLogging({ objects }: { objects: ObjectWithVertices[] }) {
  useLogVertices(objects);
  return (
    <>
      <SceneBackground />
      <Lights />
      <Square />
      <Triangle />
      <Polygon />
      <InterpolatedPoints objects={objects} />
      <OrbitControls makeDefault />
    </>
  );
}

export function SceneView({ objects, setVertexData }: SceneViewProps) {
  return (
    <View style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={50} />
      <VertexScreenXCollector objects={objects} setVertexData={setVertexData} />
      <SceneWithLogging objects={objects} />
    </View>
  );
}
