import "./App.css";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import Triangle from "./Components/Triangle";
import Square from "./Components/Square";
import { useLogVertices } from "./vertexUtils";
import { InterpolatedPoints } from "./Components/useLogVertices";
import type { ObjectWithVertices, VertexData } from "./vertexUtils";
import { useRef, useState } from "react";
import { VertexDataPlot } from "./Components/VertexDataPlot";
import type { VertexDatum } from "./Components/VertexDataPlot";
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


function SceneWithLogging({ onVertexData }: { onVertexData: (data: VertexData[]) => void }) {
  const { camera } = useThree();
  
  // Custom hook to collect and forward vertex data
  useLogVertices(objects, camera, onVertexData);
  
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
  const [vertexData, setVertexData] = useState<VertexDatum[]>([]);
  const tRef = useRef(0);

  // Handler to collect vertex data from the scene
  const handleVertexData = (data: VertexData[]) => {
    tRef.current += 1;
    
    // Convert each VertexData to VertexDatum by adding time
    const newData = data.map(vertex => ({
      t: tRef.current,
      x: vertex.x,
      y: vertex.y,
      z: vertex.z,
      r: vertex.r,
      g: vertex.g,
      b: vertex.b,
    }));
    
    setVertexData(prev => [
      ...prev.slice(-199), // keep last 200
      ...newData
    ]);
  };

  return (
    <>
      <div style={{ width: "100vw", background: "#181818", padding: 16 }}>
        <VertexDataPlot data={vertexData} />
      </div>
      <Canvas>
        <OrthographicCamera makeDefault position={[0, 5, 5]} zoom={50} />
        <SceneWithLogging onVertexData={handleVertexData} />
      </Canvas>
    </>
  );
}

export default App;
