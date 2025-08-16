export type DebugStatus = {
  t: number;
  sampleRate: number;
  isPlaying: boolean;
  outputChannels?: number;
  processCalls: number;
  processCallRate: number;
  lastProcessMs: number;
  avgProcessMs: number;
  maxProcessMs: number;
  minProcessMs: number;
  tone: { enabled: boolean; freq: number; amplitude: number };
};

export class DebugAudioEngine {
  private audioContext: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private analysers: AnalyserNode[] = [];
  private _requestedSampleRate = 48000;
  private onStatusCallback: ((s: DebugStatus) => void) | null = null;
  // SAB bookkeeping
  private _sab: SharedArrayBuffer | null = null;
  private _ctrl: Int32Array | null = null;
  private _sabSamples: Float32Array | null = null;
  private _sabCapacity = 0;
  private _sabChannels = 0;

  async initialize(sampleRate: number = this._requestedSampleRate) {
    if (this.audioContext && this.audioContext.sampleRate === sampleRate && this.node) return;
    // Cleanup existing
    this.destroy();
    this._requestedSampleRate = sampleRate;
    this.audioContext = new AudioContext({ sampleRate });
    try {
      await this.audioContext.audioWorklet.addModule("/debugAudioProcessor.js");
    } catch (e) {
      console.error("Failed to load debug worklet:", e);
      throw e;
    }

    this.node = new AudioWorkletNode(this.audioContext, "debug-audio-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    // Create a splitter and per-channel analysers (for waveform visualization)
    try {
      // pick a reasonable max channels (6) and create splitter accordingly
      this.splitter = this.audioContext.createChannelSplitter(6);
      // connect node -> splitter
      this.node.connect(this.splitter);

      // create analysers for up to 6 channels
      this.analysers = [];
      for (let i = 0; i < 6; i++) {
        const a = this.audioContext.createAnalyser();
        a.fftSize = 2048;
        // connect splitter output i to analyser (safe even if channel absent)
        try {
          this.splitter.connect(a, i);
        } catch (err) {
          console.debug("splitter->analyser connect failed for channel", i, err);
        }
        this.analysers.push(a);
      }

      // Also create a merger to route first two channels to destination (preserve audible output)
      const merger = this.audioContext.createChannelMerger(2);
      // route splitter 0 -> merger input 0, splitter 1 -> merger input 1
      try {
        this.splitter.connect(merger, 0, 0);
        this.splitter.connect(merger, 1, 1);
        merger.connect(this.audioContext.destination);
      } catch (err) {
        console.debug("splitter->merger connect failed", err);
        // fallback: connect node directly
        try {
          this.node.connect(this.audioContext.destination);
        } catch (err2) {
          console.debug("node.connect to destination failed", err2);
        }
      }
    } catch (err) {
      console.debug("analyser setup failed", err);
      // if analyser setup fails, fall back to direct connect
      try {
        this.node.connect(this.audioContext.destination);
      } catch (err2) {
        console.debug("fallback node.connect to destination failed", err2);
      }
    }

    // Pass SharedArrayBuffer to worklet if available
    try {
      if (!this._sab) {
        const capacity = 8192; // per-channel, power-of-two (reduced)
        const channels = 2; // stereo by default
        const controlInts = 4;
        const controlBytes = controlInts * 4;
        const samplesBytes = Float32Array.BYTES_PER_ELEMENT * capacity * channels;
        this._sab = new SharedArrayBuffer(controlBytes + samplesBytes);
        this._ctrl = new Int32Array(this._sab, 0, controlInts);
        this._sabSamples = new Float32Array(this._sab, controlBytes);
        this._sabCapacity = capacity;
        this._sabChannels = channels;
        // zero indices
        Atomics.store(this._ctrl, 0, 0);
        Atomics.store(this._ctrl, 1, 0);
      }
      // send SAB to worklet
      try {
        this.node.port.postMessage({ type: "initSAB", sab: this._sab, capacity: this._sabCapacity, channels: this._sabChannels });
      } catch (err) {
        console.debug("postMessage initSAB failed", err);
      }
    } catch (err) {
      console.debug("SAB allocation failed", err);
    }

    // Listen for status messages
    this.node.port.onmessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (data && data.type === "status") {
        if (this.onStatusCallback) this.onStatusCallback(data as DebugStatus);
      }
    };
  }

  setOnStatus(cb: (s: DebugStatus) => void) {
    this.onStatusCallback = cb;
  }

  async start() {
    if (!this.node) await this.initialize(this._requestedSampleRate);
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") await this.audioContext.resume();
    this.node?.port.postMessage({ type: "setPlaying", playing: true });
  }

  stop() {
    this.node?.port.postMessage({ type: "setPlaying", playing: false });
  }

  enableTestTone(enabled: boolean, freq?: number, amplitude?: number) {
    this.node?.port.postMessage({ type: "enableTestTone", enabled, freq, amplitude });
  }

  requestStatus() {
    this.node?.port.postMessage({ type: "requestStatus" });
  }

  clearStats() {
    this.node?.port.postMessage({ type: "clearStats" });
  }

  // Return the time-domain waveform for a specific channel as a Uint8Array (or null if not available)
  getChannelWaveform(channelIndex: number): Uint8Array | null {
    // If SAB is present, read raw floats and convert to Uint8Array (0-255) for UI
    if (this._sabSamples && this._ctrl && this._sabCapacity && channelIndex >= 0 && channelIndex < this._sabChannels) {
      const WRITE_IDX = 0;
      const READ_IDX = 1; // we won't advance readIdx here (non-consuming peek)
      const write = Atomics.load(this._ctrl, WRITE_IDX);
      const read = Atomics.load(this._ctrl, READ_IDX);
      const avail = write - read;
      if (avail <= 0) return null;
      const toRead = Math.min(avail, this._sabCapacity);
      const start = read & (this._sabCapacity - 1);
      const base = channelIndex * this._sabCapacity;
      const outF = new Float32Array(toRead);
      if (start + toRead <= this._sabCapacity) {
        outF.set(this._sabSamples.subarray(base + start, base + start + toRead));
      } else {
        const part = this._sabCapacity - start;
        outF.set(this._sabSamples.subarray(base + start, base + start + part), 0);
        outF.set(this._sabSamples.subarray(base, base + (toRead - part)), part);
      }
      // convert floats (-1..1) to 0..255 Uint8
      const outU = new Uint8Array(toRead);
      for (let i = 0; i < toRead; i++) outU[i] = Math.max(0, Math.min(255, Math.round(outF[i] * 127 + 128)));
      return outU;
    }
    // Fallback to analyser if no SAB
    if (!this.analysers || channelIndex < 0 || channelIndex >= this.analysers.length) return null;
    const analyser = this.analysers[channelIndex];
    if (!analyser) return null;
    const size = analyser.fftSize;
    const out = new Uint8Array(size);
    try {
      (analyser as unknown as AnalyserNode).getByteTimeDomainData(out);
    } catch (err) {
      console.debug("analyser getByteTimeDomainData failed", err);
      return null;
    }
    return out;
  }

  async setSampleRate(rate: number) {
    this._requestedSampleRate = rate;
    if (!this.audioContext) return; // will be used at next initialize
    // Recreate context at new rate
    try {
      await this.audioContext.close();
    } catch (err) {
      console.debug("audioContext.close failed", err);
    }
    this.audioContext = null;
    this.node = null;
    await this.initialize(rate);
  }

  destroy() {
    try {
      this.node?.disconnect();
    } catch (err) {
      console.debug("node.disconnect failed", err);
    }
    try {
      this.audioContext?.close();
    } catch (err) {
      console.debug("audioContext.close failed during destroy", err);
    }
    this.node = null;
    this.audioContext = null;
  }

  get context() {
    return this.audioContext;
  }
  get workletNode() {
    return this.node;
  }
  get sampleRate() {
    return this.audioContext?.sampleRate || this._requestedSampleRate;
  }

  // Return the current global write sample index (next sample index to be written)
  getWriteIndex(): number {
    if (!this._ctrl) return 0;
    try {
      return Atomics.load(this._ctrl, 0);
    } catch (err) {
      console.debug("getWriteIndex Atomics.load failed", err);
      return 0;
    }
  }

  // Copy up to `out.length` samples for `channelIndex` ending at `endSample` (inclusive)
  // into the provided Float32Array `out`. Returns the number of samples written.
  // This is a peek-only operation and does not modify any read index in the SAB.
  getSamplesForChannel(channelIndex: number, endSample: number, out: Float32Array): number {
    if (!this._sabSamples || !this._ctrl) return 0;
    if (channelIndex < 0 || channelIndex >= this._sabChannels) return 0;
    const WRITE_IDX = 0;
    const write = Atomics.load(this._ctrl, WRITE_IDX);
    const latestSample = write - 1;
    if (latestSample < 0) return 0;
    // clamp endSample to latestSample
    if (endSample > latestSample) endSample = latestSample;
    const capacity = this._sabCapacity;
    const maxRead = out.length;
    const available = endSample + 1; // samples from 0..endSample inclusive
    const toRead = Math.min(maxRead, available);
    if (toRead <= 0) return 0;
    const startSample = endSample - toRead + 1;
    const base = channelIndex * capacity;
    const startIdx = startSample & (capacity - 1);
    if (startIdx + toRead <= capacity) {
      out.set(this._sabSamples.subarray(base + startIdx, base + startIdx + toRead), 0);
    } else {
      const first = capacity - startIdx;
      out.set(this._sabSamples.subarray(base + startIdx, base + startIdx + first), 0);
      out.set(this._sabSamples.subarray(base, base + (toRead - first)), first);
    }
    return toRead;
  }

  // Convenience: fill `out` with the most recent `out.length` samples for channel (or less if not enough).
  getLatestSamples(channelIndex: number, out: Float32Array): number {
    const end = this.getWriteIndex() - 1;
    return this.getSamplesForChannel(channelIndex, end, out);
  }
}
