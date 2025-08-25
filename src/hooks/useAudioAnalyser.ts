import { useEffect, useRef, useCallback } from 'react';

type AudioRef = React.RefObject<HTMLAudioElement | null>;

interface WindowWithAudioContext extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
  __sharedAudioCtx?: AudioContext;
}

/**
 * useAudioAnalyser - provides per-channel analysers (left/right) and a pull() helper
 * that returns the latest float time-domain samples for both channels. This is
 * useful for driving visuals at rAF frequency.
 */
export function useAudioAnalyser(audioRef: AudioRef, nSamples = 1024) {
  const analyserLeftRef = useRef<AnalyserNode | null>(null);
  const analyserRightRef = useRef<AnalyserNode | null>(null);
  const dataLeftRef = useRef(new Float32Array(nSamples));
  const dataRightRef = useRef(new Float32Array(nSamples));
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);

  useEffect(() => {
    const audioEl = audioRef?.current;
    if (!audioEl) {
      console.log('[useAudioAnalyser] no audio element');
      return;
    }

    const win = window as WindowWithAudioContext;
    const AudioCtx = win.AudioContext || win.webkitAudioContext;
    if (!AudioCtx) {
      console.log('[useAudioAnalyser] no AudioContext support');
      return;
    }

    // reuse a single AudioContext across hook instances
    win.__sharedAudioCtx = win.__sharedAudioCtx || new AudioCtx();
    const audioCtx: AudioContext = win.__sharedAudioCtx;

    console.log('[useAudioAnalyser] AudioContext state:', audioCtx.state);

    // create source and two analysers (left/right)
    let connectedGain: GainNode | null = null;
    try {
      sourceRef.current = audioCtx.createMediaElementSource(audioEl);
      console.log('[useAudioAnalyser] MediaElementSource created successfully');
    } catch (error) {
      console.error('[useAudioAnalyser] Failed to create MediaElementSource:', error);
      sourceRef.current = null;
    }

    const fft = Math.max(2048, nSamples * 2);
    const analyserL = audioCtx.createAnalyser();
    const analyserR = audioCtx.createAnalyser();
    analyserL.fftSize = fft;
    analyserR.fftSize = fft;
    analyserLeftRef.current = analyserL;
    analyserRightRef.current = analyserR;
    // resize the data buffers to match analyser.fftSize so we can call getFloatTimeDomainData directly into them
    dataLeftRef.current = new Float32Array(fft);
    dataRightRef.current = new Float32Array(fft);
    console.log('[useAudioAnalyser] Analysers created, fftSize:', fft);

    if (sourceRef.current) {
      // create splitter and route channels to separate analysers
      splitterRef.current = audioCtx.createChannelSplitter(2);
      sourceRef.current.connect(splitterRef.current);
      try {
        splitterRef.current.connect(analyserL, 0);
        splitterRef.current.connect(analyserR, 1);
      } catch (err) {
        // some browsers may throw if channels not available; fall back to mono analyser
        console.warn('[useAudioAnalyser] splitter connection failed, falling back to single analyser', err);
        sourceRef.current.connect(analyserL);
        analyserR.disconnect();
        analyserRightRef.current = null;
      }

      // create a gain node to route audio to destination so playback is audible
      try {
        connectedGain = audioCtx.createGain();
        connectedGain.gain.value = 1.0;
        sourceRef.current.connect(connectedGain);
        connectedGain.connect(audioCtx.destination);
        console.log('[useAudioAnalyser] Audio routing: source -> splitter -> analysers, source -> gain -> destination');
      } catch (error) {
        console.error('[useAudioAnalyser] Failed to connect gain node:', error);
        if (connectedGain) {
          if (connectedGain.disconnect) connectedGain.disconnect();
          connectedGain = null;
        }
      }
    }

    // ensure AudioContext resumes on user interaction (play)
    const resume = () => {
      console.log('[useAudioAnalyser] Resume triggered, current state:', audioCtx.state);
      if (audioCtx.state === 'suspended') {
        audioCtx
          .resume()
          .then(() => {
            console.log('[useAudioAnalyser] AudioContext resumed successfully');
          })
          .catch(error => {
            console.error('[useAudioAnalyser] Failed to resume AudioContext:', error);
          });
      }
    };
    audioEl.addEventListener('play', resume);

    return () => {
      console.log('[useAudioAnalyser] Cleanup');
      audioEl.removeEventListener('play', resume);
      if (sourceRef.current && sourceRef.current.disconnect) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {
          console.warn('[useAudioAnalyser] error disconnecting source', e);
        }
        sourceRef.current = null;
      }
      if (splitterRef.current && splitterRef.current.disconnect) {
        try {
          splitterRef.current.disconnect();
        } catch (e) {
          console.warn('[useAudioAnalyser] error disconnecting splitter', e);
        }
        splitterRef.current = null;
      }
      if (connectedGain && connectedGain.disconnect) {
        try {
          connectedGain.disconnect();
        } catch (e) {
          console.warn('[useAudioAnalyser] error disconnecting gain', e);
        }
      }
      if (analyserL && analyserL.disconnect) {
        try {
          analyserL.disconnect();
        } catch (e) {
          console.warn('[useAudioAnalyser] error disconnecting analyserL', e);
        }
      }
      if (analyserR && analyserR.disconnect) {
        try {
          analyserR.disconnect();
        } catch (e) {
          console.warn('[useAudioAnalyser] error disconnecting analyserR', e);
        }
      }
      analyserLeftRef.current = null;
      analyserRightRef.current = null;
      // (dataLeftRef/dataRightRef remain allocated; they're reused across pulls)
    };
  }, [audioRef, nSamples]);

  const pull = useCallback(() => {
    const leftAnalyser = analyserLeftRef.current;
    const rightAnalyser = analyserRightRef.current;

    // If neither analyser exists, return empty buffers
    if (!leftAnalyser && !rightAnalyser) {
      return { left: dataLeftRef.current, right: dataRightRef.current };
    }

    // Directly write analyser output into the preallocated data buffers (sized to analyser.fftSize)
    if (leftAnalyser && dataLeftRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leftAnalyser.getFloatTimeDomainData(dataLeftRef.current as any);
    }

    if (rightAnalyser && dataRightRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rightAnalyser.getFloatTimeDomainData(dataRightRef.current as any);
    } else {
      // fallback: copy left into right's view for downstream consumers
      dataRightRef.current.set(dataLeftRef.current);
    }

    // Return views sized to the requested nSamples to avoid forcing callers to use the full fft buffer
    return { left: dataLeftRef.current.subarray(0, nSamples), right: dataRightRef.current.subarray(0, nSamples) };
  }, [nSamples]);

  return { dataLeftRef, dataRightRef, pull, analyserLeftRef, analyserRightRef } as const;
}
