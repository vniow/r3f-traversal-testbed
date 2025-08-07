// AudioWorklet processor for real-time vertex data to audio synthesis
// This file will be loaded as a module by the Web Audio API

class VertexAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Audio buffer state
    this.bufferSize = 1024;
    this.channels = 6; // screenX, screenY, screenZ, r, g, b
    this.sampleRate = 44100;

    // Current vertex data buffers
    this.vertexBuffers = {
      screenX: new Float32Array(this.bufferSize),
      screenY: new Float32Array(this.bufferSize),
      screenZ: new Float32Array(this.bufferSize),
      r: new Float32Array(this.bufferSize),
      g: new Float32Array(this.bufferSize),
      b: new Float32Array(this.bufferSize),
    };

    // Audio synthesis parameters
    this.phase = 0;
    this.baseFrequency = 440;
    this.gain = 0.1;

    // Listen for messages from main thread
    this.port.onmessage = event => {
      if (event.data.type === "vertexData") {
        this.updateVertexData(event.data.data);
      } else if (event.data.type === "setParameter") {
        this.setParameter(event.data.name, event.data.value);
      }
    };
  }

  static get parameterDescriptors() {
    return [
      {
        name: "gain",
        defaultValue: 0.1,
        minValue: 0,
        maxValue: 1,
      },
      {
        name: "baseFrequency",
        defaultValue: 440,
        minValue: 20,
        maxValue: 2000,
      },
    ];
  }

  updateVertexData(vertexData) {
    // Convert vertex data arrays to audio buffers
    this.convertToAudioBuffer(vertexData.screenX, this.vertexBuffers.screenX);
    this.convertToAudioBuffer(vertexData.screenY, this.vertexBuffers.screenY);
    this.convertToAudioBuffer(vertexData.screenZ, this.vertexBuffers.screenZ);
    this.convertToAudioBuffer(vertexData.r, this.vertexBuffers.r);
    this.convertToAudioBuffer(vertexData.g, this.vertexBuffers.g);
    this.convertToAudioBuffer(vertexData.b, this.vertexBuffers.b);
  }

  convertToAudioBuffer(sourceData, targetBuffer) {
    if (!sourceData || sourceData.length === 0) {
      targetBuffer.fill(0);
      return;
    }

    // Interpolate or sample the source data to match buffer size
    for (let i = 0; i < targetBuffer.length; i++) {
      const sourceIndex = (i / targetBuffer.length) * (sourceData.length - 1);
      const lowerIndex = Math.floor(sourceIndex);
      const upperIndex = Math.min(lowerIndex + 1, sourceData.length - 1);
      const fraction = sourceIndex - lowerIndex;

      // Linear interpolation and map to audio range [-1, 1]
      const lowerValue = this.mapToAudioRange(sourceData[lowerIndex]);
      const upperValue = this.mapToAudioRange(sourceData[upperIndex]);
      targetBuffer[i] = lowerValue + (upperValue - lowerValue) * fraction;
    }
  }

  mapToAudioRange(value, inputMin = -1, inputMax = 1) {
    // Clamp and normalize to [-1, 1]
    const clampedValue = Math.max(inputMin, Math.min(inputMax, value));
    return ((clampedValue - inputMin) / (inputMax - inputMin)) * 2 - 1;
  }

  setParameter(name, value) {
    switch (name) {
      case "gain":
        this.gain = value;
        break;
      case "baseFrequency":
        this.baseFrequency = value;
        break;
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frameCount = output[0].length;

    // Get parameter values (could be k-rate or a-rate)
    const gain = parameters.gain;
    const baseFreq = parameters.baseFrequency;

    // Generate audio for each channel from corresponding vertex data
    const bufferNames = ["screenX", "screenY", "screenZ", "r", "g", "b"];

    for (let channel = 0; channel < Math.min(output.length, this.channels); channel++) {
      const outputChannel = output[channel];
      const bufferName = bufferNames[channel];
      const vertexBuffer = this.vertexBuffers[bufferName];

      if (!vertexBuffer || !outputChannel) continue;

      for (let i = 0; i < frameCount; i++) {
        // Method 1: Direct waveform output (use vertex data as audio samples)
        const bufferIndex = Math.floor((this.phase / (Math.PI * 2)) * vertexBuffer.length) % vertexBuffer.length;
        let sample = vertexBuffer[bufferIndex];

        // Method 2: Oscillator modulated by vertex data (alternative synthesis method)
        // Uncomment to use oscillator-based synthesis instead:
        /*
        const currentGain = gain.length === 1 ? gain[0] : gain[i];
        const currentFreq = baseFreq.length === 1 ? baseFreq[0] : baseFreq[i];
        
        // Use vertex data to modulate frequency and amplitude
        const freqMod = 1 + (vertexBuffer[bufferIndex] * 0.5); // ±50% frequency modulation
        const ampMod = Math.abs(vertexBuffer[bufferIndex]); // Use absolute value for amplitude
        
        sample = Math.sin(this.phase * freqMod) * ampMod * currentGain;
        this.phase += (2 * Math.PI * currentFreq) / this.sampleRate;
        */

        // Apply gain
        const currentGain = gain.length === 1 ? gain[0] : gain[i];
        outputChannel[i] = sample * currentGain;
      }

      // Advance phase for next frame (for oscillator mode)
      this.phase += (2 * Math.PI * frameCount) / this.sampleRate;
      if (this.phase > 2 * Math.PI) {
        this.phase -= 2 * Math.PI;
      }
    }

    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor("vertex-audio-processor", VertexAudioProcessor);
