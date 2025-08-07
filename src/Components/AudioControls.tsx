import React, { useState } from "react";
import { useVertexAudio, type AudioAnalysisData } from "./useVertexAudio";

interface AudioControlsProps {
  vertexData: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source?: ("object" | "interpolated")[];
  };
  style?: React.CSSProperties;
}

function AudioAnalysisVisualizer({ analysisData }: { analysisData: AudioAnalysisData[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Audio Analysis</div>
      {analysisData.map((data, index) => (
        <div key={index} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{data.channelName}</div>
          <div style={{ display: "flex", gap: 1, height: 20 }}>
            {Array.from(data.frequencyData.slice(0, 32)).map((value, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: `${(value / 255) * 100}%`,
                  backgroundColor: `hsl(${index * 60}, 70%, 60%)`,
                  alignSelf: "flex-end",
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AudioControls({ vertexData, style }: AudioControlsProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [globalGain, setGlobalGain] = useState(0.1);
  const [channelGains, setChannelGains] = useState([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
  const [showAnalysis, setShowAnalysis] = useState(true);

  const {
    isInitialized,
    isConnected,
    analysisData,
    sendVertexData,
    setChannelGain,
    setGlobalGain: setAudioGlobalGain,
  } = useVertexAudio({
    enabled: audioEnabled,
    gain: globalGain,
    autoConnect: true,
    analysisEnabled: showAnalysis,
  });

  // Send vertex data to audio system when connected
  React.useEffect(() => {
    if (isConnected && vertexData) {
      sendVertexData(vertexData);
    }
  }, [isConnected, vertexData, sendVertexData]);

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  const handleGlobalGainChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const gain = parseFloat(event.target.value);
    setGlobalGain(gain);
    setAudioGlobalGain(gain);
  };

  const handleChannelGainChange = (channelIndex: number, gain: number) => {
    const newGains = [...channelGains];
    newGains[channelIndex] = gain;
    setChannelGains(newGains);
    setChannelGain(channelIndex, gain);
  };

  const channelNames = ["Screen X", "Screen Y", "Screen Z", "Red", "Green", "Blue"];
  const channelColors = ["#00ff99", "#ff9900", "#9900ff", "#ff0000", "#00ff00", "#0099ff"];

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "#2a2a2a",
        borderRadius: 8,
        color: "white",
        fontFamily: "monospace",
        fontSize: 12,
        ...style,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Audio Synthesis</h3>

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={toggleAudio}
            style={{
              backgroundColor: audioEnabled ? "#4CAF50" : "#555",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {audioEnabled ? (isConnected ? "🔊 Audio ON" : "⏳ Starting...") : "🔇 Audio OFF"}
          </button>

          {isInitialized && (
            <span style={{ marginLeft: 12, fontSize: 10, color: "#888" }}>Status: {isConnected ? "Connected" : "Disconnected"}</span>
          )}
        </div>

        {isConnected && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4 }}>Global Gain: {globalGain.toFixed(2)}</label>
              <input
                type='range'
                min='0'
                max='0.5'
                step='0.01'
                value={globalGain}
                onChange={handleGlobalGainChange}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}>Channel Gains</div>
              {channelNames.map((name, index) => (
                <div key={index} style={{ marginBottom: 6 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: channelColors[index],
                        borderRadius: 2,
                      }}
                    />
                    <span style={{ minWidth: 60 }}>{name}:</span>
                    <input
                      type='range'
                      min='0'
                      max='0.2'
                      step='0.01'
                      value={channelGains[index]}
                      onChange={e => handleChannelGainChange(index, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: 35, textAlign: "right" }}>{channelGains[index].toFixed(2)}</span>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type='checkbox' checked={showAnalysis} onChange={e => setShowAnalysis(e.target.checked)} />
                Show Analysis
              </label>
            </div>
          </>
        )}
      </div>

      {isConnected && showAnalysis && analysisData.length > 0 && <AudioAnalysisVisualizer analysisData={analysisData} />}

      {isConnected && (
        <div style={{ marginTop: 16, fontSize: 10, color: "#666" }}>
          <div>Data Points: {vertexData.screenX.length}</div>
          <div>Channels: {channelNames.length}</div>
          <div>Sample Rate: 44.1kHz</div>
        </div>
      )}
    </div>
  );
}
