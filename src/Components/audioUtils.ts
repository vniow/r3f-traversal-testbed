export interface VertexAudioData {
  screenX: number[];
  screenY: number[];
  screenZ: number[];
  r: number[];
  g: number[];
  b: number[];
}

export interface AudioChannelConfig {
  name: string;
  gain: number;
  color: string;
}

export const AUDIO_CHANNELS: Record<string, AudioChannelConfig> = {
  screenX: { name: "Screen X", gain: 1, color: "#00ff99" },
  screenY: { name: "Screen Y", gain: 1, color: "#ff9900" },
  screenZ: { name: "Intensity", gain: 1, color: "#cccccc" }, // repurposed as intensity
  r: { name: "Red", gain: 1, color: "#ff0000" },
  g: { name: "Green", gain: 1, color: "#00ff00" },
  b: { name: "Blue", gain: 1, color: "#0099ff" },
};

export class VertexAudioEngine {
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private isPlaying = false;
  private lastVertexData: VertexAudioData | null = null;
  private channelGains: Record<string, number> = {};
  private globalGain: number = 1;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();

      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule("/vertexAudioProcessor.js");

      // Create the AudioWorklet node with 6 output channels
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, "vertex-audio-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [6], // 6-channel output
      });

      // Connect to audio context destination so downstream analyzers can pull audio
      // this.audioWorkletNode.connect(this.audioContext.destination);

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize vertex audio engine:", error);
      throw error;
    }
  }

  updateVertexData(vertexData: VertexAudioData): void {
    if (!this.audioWorkletNode) return;
    this.lastVertexData = vertexData;

    this.audioWorkletNode.port.postMessage({
      type: "updateVertexData",
      vertexData,
    });
  }

  setChannelGain(channel: string, gain: number): void {
    if (!this.audioWorkletNode) return;
    this.channelGains[channel] = gain;

    this.audioWorkletNode.port.postMessage({
      type: "setChannelGain",
      channel,
      gain,
    });
  }

  setGlobalGain(gain: number): void {
    if (!this.audioWorkletNode) return;
    this.globalGain = gain;

    this.audioWorkletNode.port.postMessage({
      type: "setGlobalGain",
      gain,
    });
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.audioWorkletNode?.port.postMessage({
      type: "setPlaying",
      playing: true,
    });
  }

  stop(): void {
    this.isPlaying = false;
    this.audioWorkletNode?.port.postMessage({
      type: "setPlaying",
      playing: false,
    });
  }

  destroy(): void {
    this.stop();
    this.audioWorkletNode?.disconnect();
    this.audioContext?.close();
    this.isInitialized = false;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get context(): AudioContext | null {
    return this.audioContext;
  }

  get workletNode(): AudioWorkletNode | null {
    return this.audioWorkletNode;
  }

  // For renderers that need the exact data being played
  get dataForRender() {
    return {
      vertexData: this.lastVertexData,
      gains: { ...this.channelGains },
      globalGain: this.globalGain,
    };
  }
}
