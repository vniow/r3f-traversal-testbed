import { View, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { Color } from "three";
import type { ObjectWithVertices } from "./vertexUtils";
import { DynamicPolygon } from "./DynamicPolygon";
import Lights from "./Lights";
import { VertexScreenCollector } from "./VertexScreenCollector";

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
  interpolatedIntensity?: number;
}

function SceneBackground() {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.background = new Color("#333333");
  }, [scene]);
  return null;
}

function SceneWithLogging({ objects }: { objects: ObjectWithVertices[] }) {
  return (
    <>
      <SceneBackground />
      <Lights />
      {objects.map(obj => (
        <DynamicPolygon key={obj.id ?? obj.name} object={obj} />
      ))}

      <OrbitControls makeDefault />
    </>
  );
}

export function SceneView({ objects, setVertexData, interpolatedIntensity }: SceneViewProps) {
  return (
    <View style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={50} />
      <VertexScreenCollector objects={objects} setVertexData={setVertexData} interpolatedIntensity={interpolatedIntensity} />
      <SceneWithLogging objects={objects} />
    </View>
  );
}
