import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import type { ObjectWithVertices } from "./Components/vertexUtils";
import { SQUARE_POINTS, SQUARE_COLORS } from "./Components/squarePoints";
import { TRIANGLE_POINTS, TRIANGLE_COLORS } from "./Components/trianglePoints";
import { POLYGON_POINTS, POLYGON_COLORS } from "./Components/polygonPoints";
import GraphView from "./Components/GraphView";
import { AudioControls } from "./Components/AudioControls";
import { useState } from "react";
import { SceneView } from "./Components/SceneView";

const objects: ObjectWithVertices[] = [
  {
    name: "Triangle",
    points: TRIANGLE_POINTS,
    colors: TRIANGLE_COLORS,
  },
  {
    name: "Square",
    points: SQUARE_POINTS,
    colors: SQUARE_COLORS,
  },

  {
    name: "Polygon",
    points: POLYGON_POINTS,
    colors: POLYGON_COLORS,
  },
];

function App() {
  const [vertexData, setVertexData] = useState<{
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source?: ("object" | "interpolated")[];
  }>({
    screenX: [],
    screenY: [],
    screenZ: [],
    r: [],
    g: [],
    b: [],
    source: [],
  });

  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", width: "100%", height: "100vh" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <GraphView vertexData={vertexData} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 256, minWidth: 256, marginLeft: 24 }}>
          <div style={{ width: "100%", aspectRatio: "1 / 1" }}>
            <SceneView objects={objects} setVertexData={setVertexData} />
          </div>
          <div style={{ width: "100%" }}>
            <AudioControls vertexData={vertexData} />
          </div>
        </div>
      </div>
      <Canvas style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <View.Port />
      </Canvas>
    </>
  );
}

export default App;
