import { useState, useEffect } from "react";

interface DebugStats {
  processCalls?: number;
  processCallRate?: number;
  lastProcessMs?: number;
  avgProcessMs?: number;
  maxProcessMs?: number;
}

interface DebugControlsProps {
  isInitialized: boolean;
  isPlaying: boolean;
  sampleRate: number;
  channelCount?: number;
  stats: DebugStats | null;
  getWaveform?: (channelIndex: number) => Uint8Array | null;
  onInitialize: () => void;
  onTogglePlayback: () => void;
  onSetSampleRate: (rate: number) => void;
  onEnableTestTone: (enabled: boolean, freq?: number) => void;
  onRequestStatus: () => void; // kept for backward compat but not used in UI
}

export function DebugAudioControls({
  isInitialized,
  isPlaying,
  sampleRate,
  channelCount = 0,
  stats,

  onInitialize,
  onTogglePlayback,
  onSetSampleRate,
  onEnableTestTone,
}: DebugControlsProps) {
  const SAMPLE_RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000];
  const [toneEnabled, setToneEnabled] = useState(false);
  const [toneFreq, setToneFreq] = useState(440);

  useEffect(() => {
    onEnableTestTone(toneEnabled, toneFreq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toneEnabled, toneFreq]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        padding: 24,
        background: "#0f1720",
        color: "#fff",
        borderRadius: 0,
        overflow: "auto",
        zIndex: 9999,
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#bbb" }}>Audio Worklet Debug</h3>

      <div style={{ marginBottom: 12 }}>
        {!isInitialized ? (
          <button
            onClick={onInitialize}
            style={{ padding: "8px 12px", background: "#333", color: "#fff", border: "none", borderRadius: 4 }}
          >
            🔧 Init Debug Worklet
          </button>
        ) : (
          <button
            onClick={onTogglePlayback}
            style={{ padding: "8px 12px", background: isPlaying ? "#ff4444" : "#44ff44", color: "#fff", border: "none", borderRadius: 4 }}
          >
            {isPlaying ? "🔇 Stop" : "🔊 Start"}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
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
          {SAMPLE_RATES.map(r => (
            <option key={r} value={r}>
              {(r / 1000).toFixed(r >= 100000 ? 0 : 2).replace(/\.00$/, "")} kHz{r === 48000 ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#bbb" }}>Test Tone</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setToneEnabled(v => !v)}
            style={{ padding: "6px 8px", background: toneEnabled ? "#44ff44" : "#333", color: "#fff", border: "none", borderRadius: 4 }}
          >
            {toneEnabled ? "On" : "Off"}
          </button>
          <input
            type='number'
            value={toneFreq}
            onChange={e => setToneFreq(Number(e.target.value))}
            style={{ width: 80, padding: "4px 6px", borderRadius: 4, background: "#111", color: "#fff", border: "1px solid #333" }}
          />
        </div>
      </div>

      {/* removed request/clear status buttons per user request */}

      <div style={{ fontSize: 12, color: "#bbb", marginBottom: 8 }}>Metrics:</div>
      <div style={{ fontSize: 12, color: "#fff", background: "#071018", padding: 8, borderRadius: 6 }}>
        <div>Channels: {channelCount}</div>
        <div>Process Calls: {stats?.processCalls ?? "-"}</div>
        <div>Call Rate: {stats?.processCallRate ? stats.processCallRate.toFixed(1) + " /s" : "-"}</div>
        {/* removed last/avg/max process metrics per user request */}
      </div>
      {/* report interval control removed */}

      {/* waveform canvases removed; r3f overlay renders waveforms */}

      {/* logs removed per user request */}
    </div>
  );
}
