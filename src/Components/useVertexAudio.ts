import { useEffect, useRef, useCallback, useState } from "react";
import { AudioManager } from "./audioUtils";

export interface AudioAnalysisData {
  channelName: string;
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  freqBinCount: number;
}

export interface UseVertexAudioOptions {
  enabled?: boolean;
  gain?: number;
  autoConnect?: boolean;
  analysisEnabled?: boolean;
}

export function useVertexAudio(options: UseVertexAudioOptions = {}) {
  const { enabled = false, gain = 0.1, autoConnect = false, analysisEnabled = true } = options;

  const audioManagerRef = useRef<AudioManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Initialize audio system
  const initializeAudio = useCallback(async () => {
    if (!enabled || audioManagerRef.current) return;

    const audioManager = new AudioManager();
    const success = await audioManager.initialize();

    if (success) {
      audioManagerRef.current = audioManager;
      setIsInitialized(true);

      // Create analysers for each data channel
      audioManager.createAnalysers(6); // 6 channels for vertex data
    }
  }, [enabled]);

  // Connect audio graph
  const connectAudio = useCallback(async () => {
    const audioManager = audioManagerRef.current;
    if (!audioManager || !isInitialized) return;

    try {
      const workletNode = await audioManager.createVertexAudioWorklet();
      if (workletNode) {
        audioManager.connectAudioGraph();
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Failed to connect audio:", error);
    }
  }, [isInitialized]);

  // Disconnect audio
  const disconnectAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (audioManagerRef.current) {
      audioManagerRef.current.destroy();
      audioManagerRef.current = null;
    }

    setIsInitialized(false);
    setIsConnected(false);
    setAnalysisData([]);
  }, []);

  // Send vertex data to audio processor
  const sendVertexData = useCallback(
    (vertexData: {
      screenX: number[];
      screenY: number[];
      screenZ: number[];
      r: number[];
      g: number[];
      b: number[];
      source?: ("object" | "interpolated")[];
    }) => {
      if (audioManagerRef.current && isConnected) {
        audioManagerRef.current.sendVertexData(vertexData);
      }
    },
    [isConnected]
  );

  // Start real-time analysis
  const startAnalysis = useCallback(() => {
    if (!audioManagerRef.current || !analysisEnabled) return;

    const analysers = audioManagerRef.current.getAnalysers();
    const channelNames = ["Screen X", "Screen Y", "Screen Z", "Red", "Green", "Blue"];

    const analyze = () => {
      const newAnalysisData: AudioAnalysisData[] = [];

      analysers.forEach((analyser, index) => {
        const freqBinCount = analyser.frequencyBinCount;
        const frequencyData = new Uint8Array(freqBinCount);
        const timeDomainData = new Uint8Array(freqBinCount);

        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(timeDomainData);

        newAnalysisData.push({
          channelName: channelNames[index] || `Channel ${index}`,
          frequencyData,
          timeDomainData,
          freqBinCount,
        });
      });

      setAnalysisData(newAnalysisData);
      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  }, [analysisEnabled]);

  // Set gain for specific channel
  const setChannelGain = useCallback((channelIndex: number, gainValue: number) => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setGain(channelIndex, gainValue);
    }
  }, []);

  // Set gain for all channels
  const setGlobalGain = useCallback((gainValue: number) => {
    if (audioManagerRef.current) {
      const gainNodes = audioManagerRef.current.getGainNodes();
      gainNodes.forEach((_, index) => {
        audioManagerRef.current?.setGain(index, gainValue);
      });
    }
  }, []);

  // Effect to initialize audio when enabled and manage auto-connect
  useEffect(() => {
    const init = async () => {
      if (enabled) {
        await initializeAudio();
        if (autoConnect && audioManagerRef.current) {
          await connectAudio();
          if (analysisEnabled) {
            startAnalysis();
          }
        }
      } else {
        disconnectAudio();
      }
    };

    init();

    return () => {
      disconnectAudio();
    };
  }, [enabled, autoConnect, analysisEnabled, initializeAudio, connectAudio, disconnectAudio, startAnalysis]);

  // Effect to update global gain
  useEffect(() => {
    setGlobalGain(gain);
  }, [gain, setGlobalGain]);

  return {
    // State
    isInitialized,
    isConnected,
    analysisData,

    // Actions
    initializeAudio,
    connectAudio,
    disconnectAudio,
    sendVertexData,
    setChannelGain,
    setGlobalGain,

    // Audio manager access
    audioManager: audioManagerRef.current,
  };
}
