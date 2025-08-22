interface AudioControlsProps {
  isInitialized: boolean;
  isPlaying: boolean;
  globalGain: number;
  channelGains: Record<string, number>;
  onInitialize: () => void;
  onTogglePlayback: () => void;
  onSetGlobalGain: (gain: number) => void;
  onSetChannelGain: (channel: string, gain: number) => void;
}

export function AudioControls(_props: AudioControlsProps) {
  // Keep props for compatibility with existing callers but render a minimal label.
  void _props;
  return <div style={{ padding: 12, background: "#1a1a1a", borderRadius: 8, color: "#fff", fontSize: 14 }}>Audio Controls</div>;
}
