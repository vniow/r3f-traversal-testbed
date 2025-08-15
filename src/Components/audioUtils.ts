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
  // Stereo routing nodes for mixing screenX -> left, screenY -> right
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private destinationGain: GainNode | null = null;
  private destinationEnabled: boolean = true;
  private isInitialized = false;
  private isPlaying = false;
  private lastVertexData: VertexAudioData | null = null;
  private channelGains: Record<string, number> = {};
  private globalGain: number = 1;
  private _requestedSampleRate: number = 48000;

  async initialize(sampleRate: number = this._requestedSampleRate): Promise<void> {
    if (this.isInitialized && this.audioContext && this.audioContext.sampleRate === sampleRate) return;

    // If already initialized but sample rate differs, reinitialize
    if (this.isInitialized && this.audioContext && this.audioContext.sampleRate !== sampleRate) {
      await this.setSampleRate(sampleRate);
      return;
    }

    this._requestedSampleRate = sampleRate;
    try {
      this.audioContext = new AudioContext({ sampleRate });

      await this.audioContext.audioWorklet.addModule("/vertexAudioProcessor.js");

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, "vertex-audio-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [6],
      });

      // Set up main-thread stereo mix routing: take worklet outputs 0 (screenX) and 1 (screenY)
      // and merge them into a 2-channel stereo signal that can be connected to destination.
      this.setupStereoMix();

      this.isInitialized = true;
      // Reapply state if we already had some
      this.audioWorkletNode.port.postMessage({ type: "setGlobalGain", gain: this.globalGain });
      Object.entries(this.channelGains).forEach(([channel, gain]) => {
        this.audioWorkletNode?.port.postMessage({ type: "setChannelGain", channel, gain });
      });
      if (this.lastVertexData) {
        this.audioWorkletNode.port.postMessage({ type: "updateVertexData", vertexData: this.lastVertexData });
      }
      if (this.isPlaying) {
        // If we were playing before init call (unlikely), ensure playback flag is set
        this.audioWorkletNode.port.postMessage({ type: "setPlaying", playing: true });
      }
    } catch (error) {
      console.error("Failed to initialize vertex audio engine:", error);
      throw error;
    }
  }

  // Create a ChannelSplitter -> ChannelMerger graph that routes output channel 0 -> left, 1 -> right
  private setupStereoMix(): void {
    if (!this.audioContext || !this.audioWorkletNode) return;

    // Clean up any previous nodes
    try {
      this.audioWorkletNode.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.splitter?.disconnect();
      this.merger?.disconnect();
      this.destinationGain?.disconnect();
    } catch {
      /* ignore */
    }

    this.splitter = this.audioContext.createChannelSplitter(6);
    this.merger = this.audioContext.createChannelMerger(2);
    this.destinationGain = this.audioContext.createGain();

    // Default destination gain to unity
    this.destinationGain.gain.value = 1;

    // Connect worklet -> splitter
    try {
      this.audioWorkletNode.connect(this.splitter);
    } catch {
      /* Some contexts may throw if nodes are in odd states; ignore here */
    }

    // Route splitter output 0 (screenX) -> merger input 0 (left)
    this.splitter.connect(this.merger, 0, 0);
    // Route splitter output 1 (screenY) -> merger input 1 (right)
    this.splitter.connect(this.merger, 1, 1);

    // Merge -> destinationGain
    this.merger.connect(this.destinationGain);

    // Connect destinationGain to audioContext.destination if enabled
    if (this.destinationEnabled) {
      try {
        this.destinationGain.connect(this.audioContext.destination);
      } catch {
        /* ignore */
      }
    }
  }

  // Toggle whether the stereo mix is connected to the context destination
  public setDestinationEnabled(enabled: boolean): void {
    this.destinationEnabled = !!enabled;
    if (!this.audioContext || !this.destinationGain) return;
    try {
      if (this.destinationEnabled) {
        this.destinationGain.connect(this.audioContext.destination);
      } else {
        // disconnect specific connection if possible
        try {
          this.destinationGain.disconnect(this.audioContext.destination);
        } catch {
          // fallback: mute
          this.destinationGain.gain.value = 0;
        }
      }
    } catch {
      // As a safe fallback, set gain to 0/1
      this.destinationGain.gain.value = this.destinationEnabled ? 1 : 0;
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
    try {
      this.audioWorkletNode?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.splitter?.disconnect();
      this.merger?.disconnect();
      this.destinationGain?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.audioContext?.close();
    } catch {
      /* ignore */
    }
    this.isInitialized = false;
  }

  async setSampleRate(sampleRate: number): Promise<void> {
    // Always store requested sample rate
    this._requestedSampleRate = sampleRate;

    // If not yet initialized just record desired sample rate; actual init happens later
    if (!this.isInitialized || !this.audioContext) {
      return;
    }

    if (this.audioContext.sampleRate === sampleRate) return; // no-op
    const wasPlaying = this.isPlaying;
    // Preserve state
    const lastData = this.lastVertexData;
    const gains = { ...this.channelGains };
    const global = this.globalGain;

    // Tear down old context
    this.audioWorkletNode?.disconnect();
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        /* ignore */
      }
    }
    this.isInitialized = false;
    this.isPlaying = false;

    // Set requested sample rate and reinitialize
    await this.initialize(sampleRate);

    // Restore state (initialize already reapplied gains & data if present)
    this.globalGain = global; // ensure property stays
    this.channelGains = gains; // ensure property stays
    if (lastData) {
      this.updateVertexData(lastData);
    }
    if (wasPlaying) {
      await this.start();
    }
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

  get sampleRate(): number | null {
    return this.audioContext?.sampleRate || this._requestedSampleRate || null;
  }

  get requestedSampleRate(): number {
    return this._requestedSampleRate;
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
