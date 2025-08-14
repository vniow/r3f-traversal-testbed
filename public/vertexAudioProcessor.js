class VertexAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Channel names
    this._channelNames = ['screenX','screenY','screenZ','r','g','b'];

    // Ring buffer based channels: power-of-two capacity for bitmask wrap.
    this.channels = {};
    this._channelNames.forEach(name => {
      this.channels[name] = {
        buffer: null,        // Float32Array once allocated
        capacity: 0,
        writeIndex: 0,       // monotonically increasing
        readIndex: 0,        // monotonically increasing
        gain: 1,
        lastSample: 0
      };
    });

    this.globalGain = 1; // Master volume
    this.isPlaying = false;
    this._lastStatusTime = 0; // last status message time
    this.defaultCapacity = 8192; // can be overridden via init message
    this.underruns = 0;
    this.droppedSamples = 0;

    // Listen for messages from main thread
    this.port.onmessage = event => {
      this.handleMessage(event.data);
    };
  }

  // --- Utility helpers ---
  nextPow2(n) {
    if (n <= 2) return 2;
    return 1 << (32 - Math.clz32(n - 1));
  }

  ensureBuffer(channelName, minCapacity) {
    const ch = this.channels[channelName];
    if (!ch) return;
    if (!ch.buffer || ch.capacity < minCapacity) {
      const target = this.nextPow2(Math.max(this.defaultCapacity, minCapacity));
      const oldBuffer = ch.buffer;
      const oldCap = ch.capacity;
      ch.buffer = new Float32Array(target);
      ch.capacity = target;
      // If we had old data, copy the most recent up to capacity
      if (oldBuffer) {
        const available = ch.writeIndex - ch.readIndex;
        const toCopy = Math.min(available, target);
        for (let i = 0; i < toCopy; i++) {
          const srcIdx = (ch.readIndex + (available - toCopy) + i) & (oldCap - 1);
          ch.buffer[i] = oldBuffer[srcIdx];
        }
        ch.readIndex = 0;
        ch.writeIndex = toCopy;
      } else {
        ch.writeIndex = 0;
        ch.readIndex = 0;
      }
    }
  }

  appendSamples(channelName, samples) {
    const ch = this.channels[channelName];
    if (!ch || !samples) return;
    const len = samples.length;
    if (len === 0) return;
    this.ensureBuffer(channelName, ch.capacity || len);
    const mask = ch.capacity - 1;
    for (let i = 0; i < len; i++) {
      ch.buffer[ch.writeIndex & mask] = samples[i];
      ch.writeIndex++;
      // Drop oldest if over capacity
      if (ch.writeIndex - ch.readIndex > ch.capacity) {
        ch.readIndex = ch.writeIndex - ch.capacity;
        this.droppedSamples++;
      }
      ch.lastSample = samples[i];
    }
  }

  getAvailable(channelName) {
    const ch = this.channels[channelName];
    return ch ? (ch.writeIndex - ch.readIndex) : 0;
  }

  buildStatusPayload() {
    const available = {};
    const capacity = {};
    this._channelNames.forEach(name => {
      available[name] = this.getAvailable(name);
      capacity[name] = this.channels[name].capacity;
    });
    return {
      type: 'status',
      t: (typeof currentTime !== 'undefined') ? currentTime : 0,
      available,
      capacity,
      underruns: this.underruns,
      droppedSamples: this.droppedSamples,
      sampleRate: (typeof sampleRate !== 'undefined') ? sampleRate : 44100,
      globalGain: this.globalGain
    };
  }

  // Backward compatibility: replace-style update (treated as reset+append)
  handleReplace(vertexData) {
    this._channelNames.forEach(name => {
      const arr = vertexData[name];
      if (arr && arr.length) {
        // Hard reset channel
        const ch = this.channels[name];
        ch.buffer = null;
        ch.capacity = 0;
        ch.writeIndex = 0;
        ch.readIndex = 0;
        this.appendSamples(name, Array.isArray(arr) ? arr : Array.from(arr));
      }
    });
    // Inform lengths (available) for UI
    try {
      this.port.postMessage(this.buildStatusPayload());
    } catch (e) { /* ignore */ }
  }

  handleAppend(vertexData) {
    // Determine batch length consistency
    let batchLen = null;
    for (const name of this._channelNames) {
      const arr = vertexData[name];
      if (!arr) continue;
      const l = arr.length;
      if (!l) continue;
      if (batchLen === null) batchLen = l; else if (l !== batchLen) {
        // length mismatch: abort append to maintain alignment
        return;
      }
    }
    if (!batchLen) return;
    // Append each channel
    for (const name of this._channelNames) {
      const arr = vertexData[name];
      if (arr && arr.length === batchLen) {
        this.appendSamples(name, Array.isArray(arr) ? arr : Array.from(arr));
      }
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'initRingBuffers':
        if (data.capacity) this.defaultCapacity = this.nextPow2(data.capacity);
        break;
      case 'appendVertexData':
        this.handleAppend(data.vertexData || {});
        break;
      case 'updateVertexData': // backward compatible
        this.handleReplace(data.vertexData || {});
        break;
      case 'setChannelGain':
        if (this.channels[data.channel]) {
          this.channels[data.channel].gain = data.gain;
        }
        break;
      case 'setGlobalGain':
        this.globalGain = data.gain;
        break;
      case 'setPlaying':
        this.isPlaying = data.playing;
        break;
      case 'requestStatus':
        try { this.port.postMessage(this.buildStatusPayload()); } catch (e) {}
        break;
    }
  }

  process(inputs, outputs/*, parameters */) {
    const output = outputs[0];
    const frameCount = output[0].length;

    if (!this.isPlaying) {
      for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
      return true;
    }

    const t = (typeof currentTime !== 'undefined') ? currentTime : 0;

    // Generate audio for up to first 6 channels
    for (let outputChannel = 0; outputChannel < Math.min(output.length, this._channelNames.length); outputChannel++) {
      const name = this._channelNames[outputChannel];
      const channel = this.channels[name];
      const outBuf = output[outputChannel];

      if (!channel.buffer) {
        outBuf.fill(0);
        continue;
      }

      const available = channel.writeIndex - channel.readIndex;
      const toRead = Math.min(frameCount, available);
      const mask = channel.capacity - 1;

      // Read available samples
      for (let i = 0; i < toRead; i++) {
        const sample = channel.buffer[(channel.readIndex + i) & mask];
        outBuf[i] = sample * channel.gain * this.globalGain;
      }
      channel.readIndex += toRead;

      // Underrun handling: zero fill remainder
      if (toRead < frameCount) {
        for (let i = toRead; i < frameCount; i++) outBuf[i] = 0;
        this.underruns++;
      }
    }

    // Periodic status (e.g., every ~0.25s)
    if (t - this._lastStatusTime > 0.25) {
      this._lastStatusTime = t;
      try { this.port.postMessage(this.buildStatusPayload()); } catch (e) {}
    }

    return true;
  }
}

registerProcessor('vertex-audio-processor', VertexAudioProcessor);
