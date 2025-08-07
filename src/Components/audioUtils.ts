// Audio utilities for converting vertex data to audio synthesis

export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  baseFrequency: number;
  gain: number;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 44100,
  bufferSize: 1024,
  channels: 6, // One for each data stream: screenX, screenY, screenZ, r, g, b
  baseFrequency: 440,
  gain: 0.1,
};

/**
 * Maps vertex data values to audio sample range [-1, 1]
 */
export function mapToAudioRange(value: number, inputMin = -1, inputMax = 1): number {
  // Clamp input to expected range
  const clampedValue = Math.max(inputMin, Math.min(inputMax, value));
  // Map to [-1, 1] range for audio
  return ((clampedValue - inputMin) / (inputMax - inputMin)) * 2 - 1;
}

/**
 * Converts an array of vertex data to audio samples
 */
export function vertexDataToAudioSamples(data: number[], targetLength: number = DEFAULT_AUDIO_CONFIG.bufferSize): Float32Array {
  const samples = new Float32Array(targetLength);

  if (data.length === 0) {
    return samples; // Return silence if no data
  }

  // Interpolate or sample the data to match target length
  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = (i / targetLength) * (data.length - 1);
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(lowerIndex + 1, data.length - 1);
    const fraction = sourceIndex - lowerIndex;

    // Linear interpolation
    const lowerValue = mapToAudioRange(data[lowerIndex]);
    const upperValue = mapToAudioRange(data[upperIndex]);
    samples[i] = lowerValue + (upperValue - lowerValue) * fraction;
  }

  return samples;
}

/**
 * Creates frequency domain coefficients for PeriodicWave synthesis
 */
export function createPeriodicWaveCoefficients(data: number[], harmonics: number = 16): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);

  // DC component (index 0) should be 0
  real[0] = 0;
  imag[0] = 0;

  // Generate harmonics based on data characteristics
  for (let h = 1; h <= harmonics; h++) {
    if (h - 1 < data.length) {
      // Use data values to influence harmonic content
      const dataValue = mapToAudioRange(data[h - 1]);
      real[h] = dataValue * (1 / h); // Fundamental gets full amplitude, harmonics decay
      imag[h] = dataValue * Math.sin((h * Math.PI) / 4) * (1 / h); // Add phase relationships
    } else {
      real[h] = 0;
      imag[h] = 0;
    }
  }

  return { real, imag };
}

/**
 * Maps vertex screen data to frequency values
 */
export function dataToFrequency(
  value: number,
  baseFreq: number = DEFAULT_AUDIO_CONFIG.baseFrequency,
  range: number = 2 // octaves
): number {
  const normalizedValue = mapToAudioRange(value);
  // Map to frequency range: baseFreq to baseFreq * 2^range
  const freqMultiplier = Math.pow(2, normalizedValue * range);
  return baseFreq * freqMultiplier;
}

/**
 * Audio context management utilities
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private analysers: AnalyserNode[] = [];
  private gainNodes: GainNode[] = [];
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();

      // Load the audio worklet processor
      await this.audioContext.audioWorklet.addModule("/vertexAudioProcessor.js");

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      return false;
    }
  }

  createAnalysers(count: number = DEFAULT_AUDIO_CONFIG.channels): AnalyserNode[] {
    if (!this.audioContext) throw new Error("Audio context not initialized");

    this.analysers = [];
    this.gainNodes = [];

    for (let i = 0; i < count; i++) {
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = DEFAULT_AUDIO_CONFIG.gain;

      this.analysers.push(analyser);
      this.gainNodes.push(gainNode);
    }

    return this.analysers;
  }

  async createVertexAudioWorklet(): Promise<AudioWorkletNode | null> {
    if (!this.audioContext || !this.isInitialized) {
      console.error("Audio context not initialized");
      return null;
    }

    try {
      this.workletNode = new AudioWorkletNode(this.audioContext, "vertex-audio-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [DEFAULT_AUDIO_CONFIG.channels],
      });

      return this.workletNode;
    } catch (error) {
      console.error("Failed to create audio worklet:", error);
      return null;
    }
  }

  connectAudioGraph(): void {
    if (!this.audioContext || !this.workletNode || this.analysers.length === 0) {
      throw new Error("Audio components not properly initialized");
    }

    // Create a channel splitter to separate the multi-channel output
    const splitter = this.audioContext.createChannelSplitter(DEFAULT_AUDIO_CONFIG.channels);
    this.workletNode.connect(splitter);

    // Connect each channel to its own gain node and analyser
    for (let i = 0; i < this.analysers.length; i++) {
      if (i < DEFAULT_AUDIO_CONFIG.channels) {
        splitter.connect(this.gainNodes[i], i);
        this.gainNodes[i].connect(this.analysers[i]);

        // Optional: connect to destination for audio output
        // this.gainNodes[i].connect(this.audioContext.destination);
      }
    }
  }

  sendVertexData(vertexData: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source?: ("object" | "interpolated")[];
  }): void {
    if (!this.workletNode) return;

    // Send data to the audio worklet processor
    this.workletNode.port.postMessage({
      type: "vertexData",
      data: vertexData,
    });
  }

  getAnalysers(): AnalyserNode[] {
    return this.analysers;
  }

  getGainNodes(): GainNode[] {
    return this.gainNodes;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  setGain(channelIndex: number, gain: number): void {
    if (channelIndex < this.gainNodes.length) {
      this.gainNodes[channelIndex].gain.setValueAtTime(gain, this.audioContext?.currentTime || 0);
    }
  }

  destroy(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    this.analysers.forEach(analyser => analyser.disconnect());
    this.gainNodes.forEach(gain => gain.disconnect());

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
  }
}
