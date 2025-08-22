import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { SceneView } from "./Components/SceneView";
import { AudioControls } from "./Components/AudioControls";

function App() {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", width: "100%", height: "100vh" }}>
        <div style={{ flex: 1, minWidth: 0 }}>{/* GraphView removed from simplified setup */}</div>
        <div style={{ display: "flex", flexDirection: "row", gap: 24, marginLeft: 24 }}>
          <div style={{ width: 256, minWidth: 256 }}>
            <AudioControls />
          </div>
          <div style={{ width: 256, minWidth: 256, aspectRatio: "1 / 1" }}>
            <SceneView />
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
