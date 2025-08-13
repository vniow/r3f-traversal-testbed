class VertexAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 6 channels: screenX, screenY, screenZ, r, g, b
    this.channels = {
      screenX: { data: [], playbackIndex: 0, gain: 1 },
      screenY: { data: [], playbackIndex: 0, gain: 1 },
      screenZ: { data: [], playbackIndex: 0, gain: 1 },
      r: { data: [], playbackIndex: 0, gain: 1 },
      g: { data: [], playbackIndex: 0, gain: 1 },
      b: { data: [], playbackIndex: 0, gain: 1 },
    };

    this.globalGain = 1; // Master volume
    this.isPlaying = false;
    this._lastTickTime = 0;

    // Listen for messages from main thread
    this.port.onmessage = event => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case "updateVertexData":
        // Update all channel data
        Object.keys(this.channels).forEach(channel => {
          if (data.vertexData[channel]) {
            this.channels[channel].data = data.vertexData[channel];
            // Reset playback index if new data is shorter
            if (this.channels[channel].playbackIndex >= this.channels[channel].data.length) {
              this.channels[channel].playbackIndex = 0;
            }
          }
        });
        // Inform main thread about current channel lengths and sampleRate so UI can isolate loop segment
        try {
          const lengths = {};
          Object.keys(this.channels).forEach(name => {
            lengths[name] = Array.isArray(this.channels[name].data) ? this.channels[name].data.length : 0;
          });
          // sampleRate is available on AudioWorkletGlobalScope in AudioWorkletProcessor context
          const sr = typeof sampleRate !== "undefined" ? sampleRate : 44100;
          this.port.postMessage({ type: "channelInfo", lengths, sampleRate: sr });
        } catch (e) {
          // ignore
        }
        break;

      case "setChannelGain":
        if (this.channels[data.channel]) {
          this.channels[data.channel].gain = data.gain;
        }
        break;

      case "setGlobalGain":
        this.globalGain = data.gain;
        break;

      case "setPlaying":
        this.isPlaying = data.playing;
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frameCount = output[0].length;

    if (!this.isPlaying) {
      // Output silence when not playing
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0);
      }
      return true;
    }

    // Generate audio for each output channel
    const channelNames = Object.keys(this.channels);
    // Track wrap on a reference channel (screenX) for loop tick notifications
    const refName = "screenX";
    const ref = this.channels[refName];
    const refLen = ref?.data?.length || 0;
    const refPrev = ref ? ref.playbackIndex : 0;

    for (let outputChannel = 0; outputChannel < Math.min(output.length, 6); outputChannel++) {
      const channelName = channelNames[outputChannel];
      const channelData = this.channels[channelName];
      const outputBuffer = output[outputChannel];

      if (channelData.data.length === 0) {
        outputBuffer.fill(0);
        continue;
      }

      // Generate frames for this channel
      for (let i = 0; i < frameCount; i++) {
        // Get current sample from vertex data
        const sample = channelData.data[channelData.playbackIndex] || 0;

        // Apply gain scaling
        outputBuffer[i] = sample * channelData.gain * this.globalGain;

        // Advance playback index (loop when we reach the end)
        channelData.playbackIndex = (channelData.playbackIndex + 1) % channelData.data.length;
      }
    }

    // After processing the block, if the reference channel wrapped, notify main thread once.
    if (refLen > 0) {
      const refNow = this.channels[refName].playbackIndex;
      const crossed = refPrev + frameCount >= refLen; // crossed at least once
      if (crossed) {
        const lengths = {};
        channelNames.forEach(name => {
          lengths[name] = this.channels[name].data.length || 0;
        });
        const gains = {};
        channelNames.forEach(name => {
          gains[name] = this.channels[name].gain;
        });
        const t = typeof currentTime !== "undefined" ? currentTime : 0;
        // Throttle duplicates within the same quantum
        if (t !== this._lastTickTime) {
          this._lastTickTime = t;
          this.port.postMessage({
            type: "loopTick",
            t,
            lengths,
            gains,
            globalGain: this.globalGain,
          });
        }
      }
    }

    return true;
  }
}

registerProcessor("vertex-audio-processor", VertexAudioProcessor);
