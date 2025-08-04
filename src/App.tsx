import "./App.css";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import Triangle from "./Components/Triangle";
import Square from "./Components/Square";
import { useLogVertices } from "./Components/vertexUtils";
import { InterpolatedPoints } from "./Components/useLogVertices";
import type { ObjectWithVertices } from "./Components/vertexUtils";
import Lights from "./Components/Lights";



const objects: ObjectWithVertices[] = [
  {
    name: "Square",
    points: [
      [-1.5, -0.5, 0],
      [-0.5, -0.5, 0],
      [-0.5, 0.5, 0],
      [-1.5, 0.5, 0],
      [-1.5, -0.5, 0],
    ],
    colors: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
  },
  {
    name: "Triangle",
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [0.5, 1, 0],
      [0, 0, 0],
    ],
    colors: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
  },
];

function SceneWithLogging() {
  useLogVertices(objects);
  return (
    <>
      <Lights />
      <Square />
      <Triangle />
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
