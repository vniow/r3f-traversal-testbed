import { useEffect, useRef, useState, useCallback } from "react";
import { VertexAudioEngine, AUDIO_CHANNELS, type VertexAudioData } from "./audioUtils";

export function useVertexAudio() {
  const audioEngineRef = useRef<VertexAudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [globalGain, setGlobalGainState] = useState(0.1);
  const [channelGains, setChannelGains] = useState<Record<string, number>>(
    Object.fromEntries(Object.entries(AUDIO_CHANNELS).map(([key, config]) => [key, config.gain]))
  );
  const [loopTick, setLoopTick] = useState<{ t: number; lengths: Record<string, number> } | null>(null);

  // Initialize audio engine
  const initializeAudio = useCallback(async () => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new VertexAudioEngine();
    }

    try {
      await audioEngineRef.current.initialize();
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }
  }, []);

  // Update vertex data in audio engine
  const updateVertexData = useCallback((vertexData: VertexAudioData) => {
    audioEngineRef.current?.updateVertexData(vertexData);
  }, []);

  // Start/stop audio playback
  const togglePlayback = useCallback(async () => {
    if (!audioEngineRef.current) return;

    if (isPlaying) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
    } else {
      await audioEngineRef.current.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Set global gain
  const setGlobalGain = useCallback((gain: number) => {
    setGlobalGainState(gain);
    audioEngineRef.current?.setGlobalGain(gain);
  }, []);

  // Set individual channel gain
  const setChannelGain = useCallback((channel: string, gain: number) => {
    setChannelGains(prev => ({ ...prev, [channel]: gain }));
    audioEngineRef.current?.setChannelGain(channel, gain);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.destroy();
    };
  }, []);

  // Listen to worklet port for loop ticks once initialized
  useEffect(() => {
    const node = audioEngineRef.current?.workletNode;
    if (!node) return;
    type LoopTickMsg = { type: "loopTick"; t: number; lengths: Record<string, number> };
    const handler = (e: MessageEvent) => {
      const msg = e.data as LoopTickMsg;
      if (msg && msg.type === "loopTick") {
        setLoopTick({ t: msg.t, lengths: msg.lengths || {} });
      }
    };
    node.port.addEventListener("message", handler as EventListener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node.port as any).start?.();
    return () => {
      node.port.removeEventListener("message", handler as EventListener);
    };
  }, [isInitialized]);

  return {
    isInitialized,
    isPlaying,
    globalGain,
    channelGains,
    initializeAudio,
    updateVertexData,
    togglePlayback,
    setGlobalGain,
    setChannelGain,
    audioContext: audioEngineRef.current?.context || null,
    audioWorkletNode: audioEngineRef.current?.workletNode || null,
    dataForRender: audioEngineRef.current?.dataForRender || null,
    loopTick,
  };
}
