import { useEffect, useCallback, useState } from 'react';

interface AudioBufferData {
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  sampleRate: number;
  duration: number;
}

interface WindowWithAudioContext extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  __sharedAudioCtx?: AudioContext;
}

export function useAudioBuffer(audioUrl: string) {
  const [audioData, setAudioData] = useState<AudioBufferData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudioBuffer = useCallback(async (url: string) => {
    try {
      setLoading(true);
      setError(null);

      // Create AudioContext (reuse global instance)
      const win = window as WindowWithAudioContext;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('AudioContext not supported');
      }

      win.__sharedAudioCtx = win.__sharedAudioCtx || new AudioCtx();
      const audioCtx: AudioContext = win.__sharedAudioCtx;

      // Fetch audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // Extract channels (woscope prepareAudioData pattern)
      const leftChannel = new Float32Array(audioBuffer.length);
      const rightChannel = new Float32Array(audioBuffer.length);

      // Copy channel data
      if (audioBuffer.numberOfChannels >= 1) {
        leftChannel.set(audioBuffer.getChannelData(0));
      }
      if (audioBuffer.numberOfChannels >= 2) {
        rightChannel.set(audioBuffer.getChannelData(1));
      } else {
        // Mono - duplicate left to right
        rightChannel.set(leftChannel);
      }

      const bufferData: AudioBufferData = {
        leftChannel,
        rightChannel,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      };

      setAudioData(bufferData);
      console.log('[useAudioBuffer] Loaded audio:', {
        samples: audioBuffer.length,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error loading audio';
      setError(errorMsg);
      console.error('[useAudioBuffer] Error:', errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audioUrl) {
      loadAudioBuffer(audioUrl);
    }
  }, [audioUrl, loadAudioBuffer]);

  return { audioData, loading, error, reload: () => loadAudioBuffer(audioUrl) };
}