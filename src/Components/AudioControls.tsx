import { AUDIO_CHANNELS } from "./audioUtils";

interface AudioControlsProps {
  isInitialized: boolean;
  isPlaying: boolean;
  globalGain: number;
  channelGains: Record<string, number>;
  interpolatedIntensity: number;
  sampleRate: number;
  onInitialize: () => void;
  onTogglePlayback: () => void;
  onSetGlobalGain: (gain: number) => void;
  onSetChannelGain: (channel: string, gain: number) => void;
  onSetInterpolatedIntensity: (gain: number) => void;
  onSetSampleRate: (rate: number) => void;
  destinationEnabled: boolean;
  onToggleDestination: (enabled: boolean) => void;
}

export function AudioControls({
  isInitialized,
  isPlaying,
  globalGain,
  channelGains,
  interpolatedIntensity,
  sampleRate,
  onInitialize,
  onTogglePlayback,
  onSetGlobalGain,
  onSetChannelGain,
  onSetInterpolatedIntensity,
  onSetSampleRate,
  destinationEnabled,
  onToggleDestination,
}: AudioControlsProps) {
  const SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000];
  return (
    <div style={{ padding: 16, background: "#1a1a1a", borderRadius: 8, color: "#fff" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#bbb" }}>Audio Synthesis</h3>

      {/* Initialize/Play Controls */}
      <div style={{ marginBottom: 16 }}>
        {!isInitialized ? (
          <button
            onClick={onInitialize}
            style={{
              padding: "8px 16px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            🔧 Initialize Audio
          </button>
        ) : (
          <button
            onClick={onTogglePlayback}
            style={{
              padding: "8px 16px",
              background: isPlaying ? "#ff4444" : "#44ff44",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {isPlaying ? "🔇 Audio OFF" : "🔊 Audio ON"}
          </button>
        )}
      </div>

      {/* Global Gain */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#bbb" }}>
          Global Gain: {(globalGain * 100).toFixed(0)}%
        </label>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          value={globalGain}
          onChange={e => onSetGlobalGain(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Sample Rate Selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#bbb" }}>Sample Rate</label>
        <select
          value={sampleRate}
          disabled={isPlaying && isInitialized}
          onChange={e => onSetSampleRate(parseInt(e.target.value, 10))}
          style={{
            width: "100%",
            padding: "4px 6px",
            background: "#222",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {SAMPLE_RATES.map(rate => (
            <option key={rate} value={rate}>
              {(rate / 1000).toFixed(rate >= 100000 ? 0 : 2).replace(/\.00$/, "")} kHz{rate === 48000 ? " (default)" : ""}
            </option>
          ))}
        </select>
        {!isInitialized && <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>Will initialize at {sampleRate / 1000} kHz</div>}
        {isPlaying && isInitialized && <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>Stop playback to change sample rate</div>}
      </div>

      {/* Interpolated Intensity (affects only interpolated points) */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#bbb" }}>
          Interpolated Intensity: {(interpolatedIntensity * 100).toFixed(0)}%
        </label>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          value={interpolatedIntensity}
          onChange={e => onSetInterpolatedIntensity(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Channel Gains */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 8, color: "#bbb" }}>Channel Gains:</div>
        {Object.entries(AUDIO_CHANNELS)
          .filter(([channel]) => channel !== "screenZ")
          .map(([channel, config]) => (
            <div key={channel} style={{ marginBottom: 8 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  marginBottom: 2,
                  color: config.color,
                }}
              >
                {config.name}: {(channelGains[channel] * 100).toFixed(0)}%
              </label>
              <input
                type='range'
                min='0'
                max='1'
                step='0.01'
                value={channelGains[channel]}
                onChange={e => onSetChannelGain(channel, parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          ))}
      </div>

      {/* Destination toggle: connects the stereo mix to audioContext.destination */}
      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", fontSize: 12, color: "#bbb", marginBottom: 6 }}>Destination</label>
        <button
          onClick={() => onToggleDestination(!destinationEnabled)}
          style={{
            padding: "6px 10px",
            background: destinationEnabled ? "#44ff44" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {destinationEnabled ? "Connected" : "Disconnected"}
        </button>
      </div>
    </div>
  );
}
