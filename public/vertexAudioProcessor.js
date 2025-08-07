class VertexAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // 6 channels: screenX, screenY, screenZ, r, g, b
    this.channels = {
      screenX: { data: [], playbackIndex: 0, gain: 0.3 },
      screenY: { data: [], playbackIndex: 0, gain: 0.25 },
      screenZ: { data: [], playbackIndex: 0, gain: 0.4 },
      r: { data: [], playbackIndex: 0, gain: 0.2 },
      g: { data: [], playbackIndex: 0, gain: 0.2 },
      b: { data: [], playbackIndex: 0, gain: 0.2 }
    };
    
    this.globalGain = 0.1; // Master volume
    this.isPlaying = false;
    
    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'updateVertexData':
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
    
    return true;
  }
}

registerProcessor('vertex-audio-processor', VertexAudioProcessor);
