import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import type { ObjectWithVertices } from "./Components/vertexUtils";
// import GraphView from "./Components/GraphView";
import { useState, useEffect, useCallback } from "react";
import { DebugAudioControls } from "./Components/DebugAudioControls";
import { DebugAudioEngine, type DebugStatus } from "./Components/DebugAudioEngine";
import { WaveformQuad } from "./Components/WaveformQuad";
import { OrthographicCamera } from "@react-three/drei";
// import { SceneView } from "./Components/SceneView";
import { useVertexAudio } from "./Components/useVertexAudio";
// import { AudioControls } from "./Components/AudioControls";
// import { RenderView } from "./Components/RenderView";
// import { WorkletGraphView } from "./Components/WorkletGraphView";
import { generateRegularPolygon } from "./Components/generatePolygon";

function App() {
  // const [interpolatedIntensity, setInterpolatedIntensity] = useState<number>(0);
  const [dynamicObjects, setDynamicObjects] = useState<ObjectWithVertices[]>([]);
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

  const allObjects = [...dynamicObjects];

  const handleAddPolygon = useCallback(() => {
    setDynamicObjects(prev => [...prev, generateRegularPolygon()]);
  }, []);

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
    destinationEnabled,
    setDestinationEnabled,
  } = useVertexAudio();

  // Debug audio engine (local instance)
  const [debugEngine] = useState(() => new DebugAudioEngine());
  const [debugInitialized, setDebugInitialized] = useState(false);
  const [debugPlaying, setDebugPlaying] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStatus | null>(null);
  // removed debugLogs and debugReportInterval state per UI simplification

  useEffect(() => {
    debugEngine.setOnStatus(s => {
      setDebugStats(s);
    });
    return () => {
      debugEngine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeDebug = async () => {
    try {
      await debugEngine.initialize(sampleRate);
      setDebugInitialized(true);
    } catch (e) {
      console.error("debug init failed", e);
    }
  };

  const toggleDebugPlayback = async () => {
    if (debugPlaying) {
      debugEngine.stop();
      setDebugPlaying(false);
    } else {
      await debugEngine.start();
      setDebugPlaying(true);
    }
  };

  const setDebugSampleRate = async (r: number) => {
    await debugEngine.setSampleRate(r);
  };

  const enableDebugTone = (enabled: boolean, freq?: number) => {
    debugEngine.enableTestTone(enabled, freq);
  };
  const requestDebugStatus = () => debugEngine.requestStatus();

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
      <DebugAudioControls
        isInitialized={debugInitialized}
        isPlaying={debugPlaying}
        sampleRate={debugEngine.sampleRate}
        channelCount={debugStats?.outputChannels ?? 0}
        stats={debugStats}
        getWaveform={(ch: number) => debugEngine.getChannelWaveform(ch) ?? null}
        onInitialize={initializeDebug}
        onTogglePlayback={toggleDebugPlayback}
        onSetSampleRate={setDebugSampleRate}
        onEnableTestTone={enableDebugTone}
        onRequestStatus={requestDebugStatus}
      />
      <Canvas style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <View.Port />
        {/* Debug waveform overlay (sample-accurate via SAB) */}
        <OrthographicCamera makeDefault position={[0, 0, 1]} zoom={300} />
        {debugInitialized && (
          <WaveformQuad engine={debugEngine} channel={1} windowSize={2048} amplitude={0.1} thickness={1} color={"#39f"} />
        )}
      </Canvas>
    </>
  );
}

export default App;
