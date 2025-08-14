import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import type { ObjectWithVertices } from "./Components/vertexUtils";
import { SQUARE_POINTS, SQUARE_COLORS } from "./Components/squarePoints";
import { TRIANGLE_POINTS, TRIANGLE_COLORS } from "./Components/trianglePoints";
import { POLYGON_POINTS, POLYGON_COLORS } from "./Components/polygonPoints";
import GraphView from "./Components/GraphView";
import { useState, useEffect } from "react";
import { SceneView } from "./Components/SceneView";
import { useVertexAudio } from "./Components/useVertexAudio";
import { AudioControls } from "./Components/AudioControls";
import { RenderView } from "./Components/RenderView";
import { WorkletGraphView } from "./Components/WorkletGraphView";

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
  const [interpolatedIntensity, setInterpolatedIntensity] = useState<number>(0);
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

  // Audio synthesis hook
  const {
    isInitialized,
    isPlaying,
    globalGain,
    channelGains,
    initializeAudio,
    updateVertexData,
    togglePlayback,
    setGlobalGain,
    setChannelGain,
    audioContext,
    audioWorkletNode,
    sampleRate,
    setSampleRate,
  } = useVertexAudio();

  // Update audio engine when vertex data changes
  useEffect(() => {
    if (isInitialized) {
      updateVertexData({
        screenX: vertexData.screenX,
        screenY: vertexData.screenY,
        screenZ: vertexData.screenZ,
        r: vertexData.r,
        g: vertexData.g,
        b: vertexData.b,
      });
    }
  }, [vertexData, isInitialized, updateVertexData]);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", width: "100%", height: "100vh" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <GraphView vertexData={vertexData} />
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 24, marginLeft: 24 }}>
          <div style={{ width: 256, minWidth: 256 }}>
            <AudioControls
              isInitialized={isInitialized}
              isPlaying={isPlaying}
              globalGain={globalGain}
              channelGains={channelGains}
              interpolatedIntensity={interpolatedIntensity}
              sampleRate={sampleRate}
              onInitialize={initializeAudio}
              onTogglePlayback={togglePlayback}
              onSetGlobalGain={setGlobalGain}
              onSetChannelGain={setChannelGain}
              onSetInterpolatedIntensity={setInterpolatedIntensity}
              onSetSampleRate={setSampleRate}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ width: 256, minWidth: 256, aspectRatio: "1 / 1" }}>
              <SceneView objects={objects} setVertexData={setVertexData} interpolatedIntensity={interpolatedIntensity} />
            </div>
            <div style={{ width: 256, minWidth: 256, aspectRatio: "1 / 1" }}>
              <RenderView audioContext={audioContext} audioWorkletNode={audioWorkletNode} />
            </div>
          </div>
          <div style={{ width: 256, minWidth: 256 }}>
            <WorkletGraphView audioContext={audioContext} audioWorkletNode={audioWorkletNode} />
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
