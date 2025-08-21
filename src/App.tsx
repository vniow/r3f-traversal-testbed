import "./App.css";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { useState, useEffect } from "react";
import { DebugAudioControls } from "./Components/DebugAudioControls";
import { DebugAudioEngine, type DebugStatus } from "./Components/DebugAudioEngine";
import RotatingBox from "./Components/RotatingBox";

function App() {
  // Debug audio engine (local instance)
  const [debugEngine] = useState(() => new DebugAudioEngine());
  const [debugInitialized, setDebugInitialized] = useState(false);
  const [debugPlaying, setDebugPlaying] = useState(false);
  const [debugStats, setDebugStats] = useState<DebugStatus | null>(null);
  const [show3D, setShow3D] = useState(false);
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
      // await debugEngine.initialize(sampleRate);
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
        show3D={show3D}
        onToggle3D={() => setShow3D(s => !s)}
        onRequestStatus={requestDebugStatus}
      />
      <Canvas style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10001 }}>
        <View.Port />

        {/* Basic lighting so meshStandardMaterial renders visibly */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <pointLight position={[-5, -5, 3]} intensity={0.25} />

        {/* <OrthographicCamera makeDefault position={[0, 0, 1]} zoom={100} /> */}
        <RotatingBox />
      </Canvas>
    </>
  );
}

export default App;
