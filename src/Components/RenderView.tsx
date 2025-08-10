import { View, OrthographicCamera, Line } from "@react-three/drei";
import { useEffect, useState, useCallback, useRef } from "react";
import { Color } from "three";
import Lights from "./Lights";

// Interface for reconstructed vertex data from audio analyzers
interface ReconstructedVertexData {
  screenX: number[];
  screenY: number[];
  screenZ: number[];
  r: number[];
  g: number[];
  b: number[];
}

interface RenderViewProps {
  audioContext?: AudioContext | null;
  audioWorkletNode?: AudioWorkletNode | null;
}

export function RenderView({ audioContext, audioWorkletNode }: RenderViewProps) {
  // Audio analyzers for each channel
  const analyzersRef = useRef<Record<string, AnalyserNode>>({});
  const animationFrameRef = useRef<number | null>(null);

  // State for reconstructed vertex data from audio analysis
  const [vertexData, setVertexData] = useState<ReconstructedVertexData>({
    screenX: [],
    screenY: [],
    screenZ: [],
    r: [],
    g: [],
    b: [],
  });

  // Initialize audio analyzers for each channel
  const initializeAnalyzers = useCallback(() => {
    if (!audioContext || !audioWorkletNode) return;

    const channelNames = ["screenX", "screenY", "screenZ", "r", "g", "b"];

    // Create a channel splitter to separate the 6-channel audio
    const splitter = audioContext.createChannelSplitter(6);
    audioWorkletNode.connect(splitter);

    // Create analyzer for each channel - similar to Reactoscope pattern
    channelNames.forEach((channelName, index) => {
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 64; // Higher resolution for time domain analysis
      analyzer.smoothingTimeConstant = 0.0; // No smoothing for direct reconstruction
      analyzer.minDecibels = -90;
      analyzer.maxDecibels = -10;

      // Connect the specific channel to its analyzer
      splitter.connect(analyzer, index);

      analyzersRef.current[channelName] = analyzer;
    });
  }, [audioContext, audioWorkletNode]);

  // Convert audio analyzer data back to vertex coordinates using time domain
  const analyzeAudioToVertexData = useCallback(() => {
    const analyzers = analyzersRef.current;
    if (Object.keys(analyzers).length === 0) return;

    const newVertexData: ReconstructedVertexData = {
      screenX: [],
      screenY: [],
      screenZ: [],
      r: [],
      g: [],
      b: [],
    };

    // Get time domain data from each analyzer (similar to Reactoscope pattern)
    Object.entries(analyzers).forEach(([channelName, analyzer]) => {
      const bufferLength = analyzer.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      // Use time domain data instead of frequency data - this gives us the actual audio waveform
      analyzer.getByteTimeDomainData(dataArray);

      // Sample the data similar to Reactoscope WaveScreen sampling pattern
      const width = 128; // Number of points for visualization
      const step = bufferLength / width;
      const sampledData: number[] = [];

      for (let i = 0; i < width; i++) {
        const pcmIndex = Math.floor(i * step);
        // Convert byte value (0-255) where 128 is zero/center
        let value = (dataArray[pcmIndex] - 128) / 128.0; // Range: [-1, 1]

        // Apply channel-specific scaling based on data type
        if (channelName === "screenX" || channelName === "screenY") {
          // Position coordinates: keep full range [-1, 1]
          // Already in correct range
        } else if (channelName === "screenZ") {
          // Z coordinate: similar to X/Y
          // Already in correct range
        } else {
          // Color channels (r, g, b): convert to [0, 1] range
          value = (value + 1) / 2; // Convert [-1, 1] to [0, 1]
          value = Math.max(0, Math.min(1, value)); // Clamp to ensure valid range
        }

        sampledData.push(value);
      }

      // Store the reconstructed data
      newVertexData[channelName as keyof ReconstructedVertexData] = sampledData;
    });

    setVertexData(newVertexData);
  }, []);

  // Animation loop for continuous audio analysis
  const animate = useCallback(() => {
    analyzeAudioToVertexData();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [analyzeAudioToVertexData]);

  // Initialize analyzers when audio context and worklet are available
  useEffect(() => {
    if (audioContext && audioWorkletNode) {
      initializeAnalyzers();

      // Start the analysis animation loop
      animate();

      return () => {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [audioContext, audioWorkletNode, initializeAnalyzers, animate]);

  // Convert vertex data to Line component format with per-vertex colors
  const getLineData = () => {
    const points: [number, number, number][] = [];
    const colors: Color[] = [];

    // Use the minimum length across all coordinate arrays
    const minLength = Math.min(
      vertexData.screenX.length,
      vertexData.screenY.length,
      vertexData.r.length,
      vertexData.g.length,
      vertexData.b.length
    );

    for (let i = 0; i < minLength; i++) {
      // Use screenX and screenY for position, optionally use screenZ
      points.push([
        vertexData.screenX[i] * 3, // Scale for visibility
        vertexData.screenY[i] * 3, // Scale for visibility
        vertexData.screenZ[i] * 0.5, // Use Z data with smaller scale
      ]);

      // Create color for each vertex using RGB data from audio analyzers
      colors.push(
        new Color(
          Math.max(0, Math.min(1, vertexData.r[i])), // Clamp to [0, 1]
          Math.max(0, Math.min(1, vertexData.g[i])), // Clamp to [0, 1]
          Math.max(0, Math.min(1, vertexData.b[i])) // Clamp to [0, 1]
        )
      );
    }

    return { points, colors };
  };

  const { points, colors } = getLineData();

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={50} />
      <Lights />
      {/* Render line visualization using reconstructed vertex data from audio */}
      {points.length > 1 && <Line points={points} vertexColors={colors} lineWidth={3} dashed={false} />}
    </View>
  );
}
