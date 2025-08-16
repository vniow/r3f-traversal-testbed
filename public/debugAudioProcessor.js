class DebugAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = typeof sampleRate !== "undefined" ? sampleRate : 44100;
    this.isPlaying = false;
    this.processCalls = 0;
    this._reportInterval = 0.25;
    this._lastReportTime = 0;
    this._lastProcessMs = 0;
    this._sumProcessMs = 0;
    this._maxProcessMs = 0;
    this._minProcessMs = Number.POSITIVE_INFINITY;
    this._tonePhase = 0;
    this._toneFreq = 440;
    this._toneEnabled = false;
    this._amplitude = 0.2;

    this.port.onmessage = ev => {
      const d = ev.data || {};
      if (d && d.type === "initSAB") {
        try {
          const controlInts = 4; // writeIdx, readIdx, capacity, channels
          const controlBytes = controlInts * 4;
          this._sab = d.sab;
          this._control = new Int32Array(this._sab, 0, controlInts);
          this._capacity = d.capacity || 16384;
          this._channels = d.channels || 2;
          this._mask = this._capacity - 1;
          this._samples = new Float32Array(this._sab, controlBytes);
        } catch (err) {
          console.debug("initSAB parsing failed in worklet", err);
          this._sab = null;
          this._control = null;
          this._samples = null;
        }
        return;
      }
      if (d.type === "setPlaying") {
        this.isPlaying = !!d.playing;
      } else if (d.type === "setReportInterval") {
        this._reportInterval = Math.max(0.01, Number(d.intervalSeconds) || 0.25);
      } else if (d.type === "enableTestTone") {
        this._toneEnabled = !!d.enabled;
        if (typeof d.freq === "number") this._toneFreq = d.freq;
        if (typeof d.amplitude === "number") this._amplitude = d.amplitude;
      } else if (d.type === "requestStatus") {
        this._postStatus(currentTime || 0);
      } else if (d.type === "clearStats") {
        this._resetStats();
      } else if (d.type === "init") {
        if (d.options && d.options.reportInterval) this._reportInterval = Math.max(0.01, d.options.reportInterval);
      }
    };
  }

  _resetStats() {
    this.processCalls = 0;
    this._lastProcessMs = 0;
    this._sumProcessMs = 0;
    this._maxProcessMs = 0;
    this._minProcessMs = Number.POSITIVE_INFINITY;
    this._lastReportTime = 0;
  }

  _postStatus(t) {
    const avg = this.processCalls ? this._sumProcessMs / this.processCalls : 0;
    const payload = {
      type: "status",
      t,
      sampleRate: this.sampleRate,
      isPlaying: this.isPlaying,
      outputChannels: this._lastOutputChannels || 0,
      processCalls: this.processCalls,
      processCallRate: this.sampleRate / 128,
      lastProcessMs: this._lastProcessMs,
      avgProcessMs: avg,
      maxProcessMs: this._maxProcessMs,
      minProcessMs: this._minProcessMs === Number.POSITIVE_INFINITY ? 0 : this._minProcessMs,
      tone: { enabled: this._toneEnabled, freq: this._toneFreq, amplitude: this._amplitude },
    };
    try {
      this.port.postMessage(payload);
    } catch (err) {
      console.debug("port.postMessage status failed", err);
    }
  }

  process(inputs, outputs /*, parameters */) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const frameCount = out[0].length;
    const perfStart = typeof performance !== "undefined" && performance.now ? performance.now() : (currentTime || 0) * 1000;

    if (!this.isPlaying) {
      for (let ch = 0; ch < out.length; ch++) out[ch].fill(0);
    } else {
      const twoPi = 2 * Math.PI;
      const phaseInc = (this._toneFreq * twoPi) / this.sampleRate;
      for (let ch = 0; ch < out.length; ch++) {
        const outBuf = out[ch];
        if (this._toneEnabled) {
          let phase = this._tonePhase + ch * 0.1;
          for (let i = 0; i < frameCount; i++) {
            outBuf[i] = Math.sin(phase) * this._amplitude;
            phase += phaseInc;
          }
          if (ch === out.length - 1) this._tonePhase = phase % twoPi;
        } else {
          outBuf.fill(0);
        }
      }
    }

    const perfEnd = typeof performance !== "undefined" && performance.now ? performance.now() : (currentTime || 0) * 1000;
    const procMs = perfEnd - perfStart;
    this._lastProcessMs = procMs;
    this._sumProcessMs += procMs;
    this._maxProcessMs = Math.max(this._maxProcessMs, procMs);
    this._minProcessMs = Math.min(this._minProcessMs, procMs);
    this.processCalls++;

    // remember output channel count for status
    try {
      this._lastOutputChannels = out.length;
    } catch (err) {
      console.debug("reading out.length failed", err);
      this._lastOutputChannels = 0;
    }

    // Write the output samples into SharedArrayBuffer if present (one atomic reservation per quantum)
    try {
      if (this._samples && this._control) {
        const WRITE_IDX = 0;
        const prev = Atomics.add(this._control, WRITE_IDX, frameCount);
        const start = prev & this._mask;
        // For each channel, write frameCount floats into its region
        for (let ch = 0; ch < Math.min(this._channels, out.length); ch++) {
          const outBuf = out[ch];
          const base = ch * this._capacity;
          if (start + frameCount <= this._capacity) {
            // contiguous
            for (let i = 0; i < frameCount; i++) this._samples[base + start + i] = outBuf[i];
          } else {
            const part = this._capacity - start;
            for (let i = 0; i < part; i++) this._samples[base + start + i] = outBuf[i];
            for (let i = 0; i < frameCount - part; i++) this._samples[base + i] = outBuf[part + i];
          }
        }
      }
    } catch (err) {
      console.debug("SAB write failed", err);
    }

    const nowT = typeof currentTime !== "undefined" ? currentTime : 0;
    if (nowT - this._lastReportTime >= this._reportInterval) {
      this._lastReportTime = nowT;
      this._postStatus(nowT);
    }

    return true;
  }
}

registerProcessor("debug-audio-processor", DebugAudioProcessor);
