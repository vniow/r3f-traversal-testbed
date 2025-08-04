import "./App.css";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import Triangle from "./Components/Triangle";
import Square from "./Components/Square";
import { useLogVertices } from "./Components/vertexUtils";
import { InterpolatedPoints } from "./Components/useLogVertices";
import type { ObjectWithVertices } from "./Components/vertexUtils";
import Polygon from "./Components/Polygon";
import { SQUARE_POINTS, SQUARE_COLORS } from "./Components/squarePoints";
import { TRIANGLE_POINTS, TRIANGLE_COLORS } from "./Components/trianglePoints";
import { POLYGON_POINTS, POLYGON_COLORS } from "./Components/polygonPoints";
import Lights from "./Components/Lights";



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

function SceneWithLogging() {
  useLogVertices(objects);
  return (
    <>
      <Lights />
      <Square />
      <Triangle />
      <Polygon />
      <InterpolatedPoints objects={objects} />
      <OrbitControls />
    </>
  );
}

function App() {
  return (
    <>
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 5, 5]} zoom={50} />
        <SceneWithLogging />
      </Canvas>
    </>
  );
}

export default App;
