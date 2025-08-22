import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
// Vertex objects and point data removed for simplified view
// no hooks required in simplified App
import { SceneView } from "./Components/SceneView";
import { useVertexAudio } from "./Components/useVertexAudio";
import { AudioControls } from "./Components/AudioControls";
// RenderView removed in simplified setup

function App() {
  // Audio synthesis hook (kept for compatibility; controls are now simplified)
  const { isInitialized, isPlaying, globalGain, channelGains, initializeAudio, togglePlayback, setGlobalGain, setChannelGain } =
    useVertexAudio();

  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", width: "100%", height: "100vh" }}>
        <div style={{ flex: 1, minWidth: 0 }}>{/* GraphView removed from simplified setup */}</div>
        <div style={{ display: "flex", flexDirection: "row", gap: 24, marginLeft: 24 }}>
          <div style={{ width: 256, minWidth: 256 }}>
            <AudioControls
              isInitialized={isInitialized}
              isPlaying={isPlaying}
              globalGain={globalGain}
              channelGains={channelGains}
              onInitialize={initializeAudio}
              onTogglePlayback={togglePlayback}
              onSetGlobalGain={setGlobalGain}
              onSetChannelGain={setChannelGain}
            />
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
