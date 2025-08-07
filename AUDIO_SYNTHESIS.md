# Audio Synthesis System Documentation

## Overview

This system transforms real-time 3D vertex data into multi-channel audio using the Web Audio API. The audio output can be analyzed using AnalyserNodes to extract frequency and time-domain data for further visualization or processing.

## Architecture

### 1. Data Flow

```
3D Vertex Data → Audio Worklet → Multi-channel Audio → Analyser Nodes → Analysis Data
     ↓               ↓                    ↓                ↓
   (x,y,z,r,g,b)  Audio Samples    6 Audio Channels   Frequency/Time Data
```

### 2. Core Components

#### AudioWorklet Processor (`vertexAudioProcessor.js`)

- Runs in audio thread for real-time processing
- Converts vertex data arrays to audio samples
- Supports 6 channels: screenX, screenY, screenZ, r, g, b
- Two synthesis modes:
  - **Direct waveform**: Uses vertex data directly as audio samples
  - **Oscillator modulation**: Uses vertex data to modulate sine wave frequency/amplitude

#### Audio Manager (`audioUtils.ts`)

- Manages Web Audio API context and nodes
- Creates and connects AnalyserNodes for each channel
- Handles audio worklet loading and instantiation
- Provides utilities for data conversion

#### React Hook (`useVertexAudio.ts`)

- React integration for audio system
- Manages component lifecycle and state
- Provides real-time analysis data
- Handles parameter updates

#### Audio Controls Component (`AudioControls.tsx`)

- UI for enabling/disabling audio
- Individual channel gain controls
- Real-time frequency analysis visualization
- Audio parameter adjustment

## Audio Synthesis Options

### Option 1: Direct Waveform Synthesis ⭐ (Current Implementation)

**Best for:** Real-time audio that directly represents vertex movement

**How it works:**

- Vertex data arrays are mapped to audio range [-1, 1]
- Each data stream (screenX, screenY, etc.) becomes an audio channel
- Data is interpolated to match audio buffer length
- Audio samples represent the actual vertex values

**Advantages:**

- Direct correlation between 3D movement and audio
- Real-time response
- No frequency constraints
- Preserves original data relationships

### Option 2: Harmonic Synthesis with PeriodicWave

**Best for:** Musical/tonal output with rich harmonics

**How it works:**

- Convert vertex data to Fourier coefficients
- Create custom PeriodicWave objects
- Drive OscillatorNodes with custom waveforms
- Each data channel becomes different harmonic content

**Implementation example:**

```typescript
const { real, imag } = createPeriodicWaveCoefficients(vertexData.screenX);
const wave = audioContext.createPeriodicWave(real, imag);
oscillator.setPeriodicWave(wave);
```

### Option 3: Oscillator Modulation

**Best for:** Frequency-based sonification

**How it works:**

- Base oscillators at different frequencies
- Vertex data modulates frequency, amplitude, or phase
- Musical intervals between channels
- Tonal output with clear pitch relationships

### Option 4: Multi-Buffer Synthesis

**Best for:** Complex soundscapes and precise timing

**How it works:**

- Create AudioBuffers from accumulated vertex data
- Use AudioBufferSourceNode for playback
- Generate new buffers as data changes
- Sample-accurate timing control

## AnalyserNode Integration

Each audio channel connects to its own AnalyserNode:

```typescript
// Create analysers for frequency/time analysis
const analysers = audioManager.createAnalysers(6);

// Get real-time analysis data
analysers.forEach((analyser, index) => {
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const timeDomainData = new Uint8Array(analyser.frequencyBinCount);

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeDomainData);

  // Use data for visualization or further processing
});
```

### Analysis Data Output

- **Frequency Data**: FFT analysis showing frequency content (0-255 per bin)
- **Time Domain Data**: Raw waveform data (0-255 per sample)
- **Frequency Bins**: Configurable resolution (default: 1024 bins)
- **Update Rate**: 60fps via requestAnimationFrame

## Usage

### Basic Setup

```typescript
// In your React component
const { isConnected, sendVertexData, analysisData } = useVertexAudio({
  enabled: true,
  gain: 0.1,
  autoConnect: true,
  analysisEnabled: true,
});

// Send vertex data
useEffect(() => {
  if (isConnected && vertexData) {
    sendVertexData(vertexData);
  }
}, [isConnected, vertexData, sendVertexData]);

// Access analysis data
analysisData.forEach(channel => {
  console.log(`${channel.channelName}:`, channel.frequencyData);
});
```

### Audio Controls Integration

```typescript
<AudioControls vertexData={vertexData} />
```

## Configuration

### Audio Parameters

- **Sample Rate**: 44.1kHz (standard)
- **Buffer Size**: 1024 samples
- **Channels**: 6 (one per vertex data stream)
- **Bit Depth**: 32-bit float
- **Latency**: ~23ms (1024/44100)

### Analyser Settings

- **FFT Size**: 2048 (configurable)
- **Frequency Bins**: 1024 (half of FFT size)
- **Smoothing**: 0.8 (temporal smoothing)
- **dB Range**: -100dB to -30dB

## Performance Considerations

### Optimization Tips

1. **Use AudioWorklet** instead of ScriptProcessorNode (deprecated)
2. **Limit update frequency** for vertex data (e.g., 60fps max)
3. **Choose appropriate buffer sizes** based on latency requirements
4. **Disable analysis** when not needed to save CPU
5. **Use efficient data structures** (Float32Array, Uint8Array)

### Memory Usage

- Vertex buffers: ~25KB (6 channels × 1024 samples × 4 bytes)
- Analysis buffers: ~12KB (6 channels × 1024 bins × 2 arrays)
- Total overhead: ~40KB + AudioContext resources

## Browser Compatibility

### Supported Features

- **AudioWorklet**: Chrome 66+, Firefox 76+, Safari 14.1+
- **Web Audio API**: All modern browsers
- **AnalyserNode**: Universal support

### Fallback Strategy

For older browsers, consider:

1. ScriptProcessorNode (deprecated but widely supported)
2. Reduced feature set
3. Polyfills for missing APIs

## Troubleshooting

### Common Issues

1. **Audio not playing**

   - Check if AudioContext is resumed (required for autoplay policies)
   - Verify worklet file is accessible at `/vertexAudioProcessor.js`
   - Ensure vertex data is being sent correctly

2. **High CPU usage**

   - Reduce analysis frequency
   - Lower FFT size
   - Disable unused channels

3. **Clicks/pops in audio**

   - Increase buffer size
   - Check for data discontinuities
   - Apply smoothing to vertex data

4. **No analysis data**
   - Verify analysers are connected
   - Check if analysis is enabled
   - Ensure data is flowing through audio graph

### Debug Tools

```typescript
// Enable debug logging
const audioManager = new AudioManager();
console.log("Audio context state:", audioManager.getAudioContext()?.state);
console.log("Analysers:", audioManager.getAnalysers().length);
```

## Future Enhancements

### Possible Improvements

1. **Real-time effects**: Reverb, delay, filtering based on 3D space
2. **Spatial audio**: 3D positioning of audio sources
3. **MIDI output**: Convert vertex data to MIDI for external synthesizers
4. **Recording**: Export audio sessions for offline analysis
5. **Advanced synthesis**: Granular synthesis, physical modeling
6. **Machine learning**: AI-driven audio generation from visual patterns

### API Extensions

```typescript
// Future API ideas
audioManager.addEffect("reverb", { roomSize: 0.8, dampening: 0.3 });
audioManager.setSpatialPosition(channelIndex, { x, y, z });
audioManager.exportToMIDI(duration);
audioManager.recordSession(outputFormat);
```

## Related Resources

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/)
- [AudioWorklet Documentation](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [AnalyserNode Reference](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [Audio Visualization Examples](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
