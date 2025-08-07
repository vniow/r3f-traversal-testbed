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
  screenX: { name: 'Screen X', gain: 0.3, color: '#00ff99' },
  screenY: { name: 'Screen Y', gain: 0.25, color: '#ff9900' },
  screenZ: { name: 'Screen Z', gain: 0.4, color: '#9900ff' },
  r: { name: 'Red', gain: 0.2, color: '#ff0000' },
  g: { name: 'Green', gain: 0.2, color: '#00ff00' },
  b: { name: 'Blue', gain: 0.2, color: '#0099ff' }
};

export class VertexAudioEngine {
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private isPlaying = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();
      
      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/vertexAudioProcessor.js');
      
      // Create the AudioWorklet node with 6 output channels
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'vertex-audio-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [6], // 6-channel output
      });
      
      // Connect to audio context destination
      this.audioWorkletNode.connect(this.audioContext.destination);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize vertex audio engine:', error);
      throw error;
    }
  }

  updateVertexData(vertexData: VertexAudioData): void {
    if (!this.audioWorkletNode) return;
    
    this.audioWorkletNode.port.postMessage({
      type: 'updateVertexData',
      vertexData
    });
  }

  setChannelGain(channel: string, gain: number): void {
    if (!this.audioWorkletNode) return;
    
    this.audioWorkletNode.port.postMessage({
      type: 'setChannelGain',
      channel,
      gain
    });
  }

  setGlobalGain(gain: number): void {
    if (!this.audioWorkletNode) return;
    
    this.audioWorkletNode.port.postMessage({
      type: 'setGlobalGain',
      gain
    });
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.isPlaying = true;
    this.audioWorkletNode?.port.postMessage({
      type: 'setPlaying',
      playing: true
    });
  }

  stop(): void {
    this.isPlaying = false;
    this.audioWorkletNode?.port.postMessage({
      type: 'setPlaying',
      playing: false
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
}
