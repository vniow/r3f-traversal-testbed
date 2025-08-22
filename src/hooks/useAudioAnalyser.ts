import { useEffect, useRef, useCallback } from 'react';

type AudioRef = React.RefObject<HTMLAudioElement | null>;

export function useAudioAnalyser(audioRef: AudioRef, nSamples = 1024) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef(new Float32Array(nSamples));
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const audioEl = audioRef?.current;
    if (!audioEl) {
      console.log('[useAudioAnalyser] no audio element');
      return;
    }

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      console.log('[useAudioAnalyser] no AudioContext support');
      return;
    }

    // reuse a single AudioContext across hook instances
    const win = window as any;
    win.__sharedAudioCtx = win.__sharedAudioCtx || new AudioCtx();
    const audioCtx: AudioContext = win.__sharedAudioCtx;

    console.log('[useAudioAnalyser] AudioContext state:', audioCtx.state);

    // create source and analyser
    let connectedGain: GainNode | null = null;
    try {
      sourceRef.current = audioCtx.createMediaElementSource(audioEl);
      console.log('[useAudioAnalyser] MediaElementSource created successfully');
    } catch (error) {
      console.error('[useAudioAnalyser] Failed to create MediaElementSource:', error);
      sourceRef.current = null;
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = Math.max(2048, nSamples * 2);
    analyserRef.current = analyser;
    console.log('[useAudioAnalyser] Analyser created, fftSize:', analyser.fftSize);

    if (sourceRef.current) {
      // connect source -> analyser
      sourceRef.current.connect(analyser);

      // create a gain node to route audio to destination so playback is audible
      try {
        connectedGain = audioCtx.createGain();
        // keep full volume by default
        connectedGain.gain.value = 1.0;
        sourceRef.current.connect(connectedGain);
        connectedGain.connect(audioCtx.destination);
        console.log('[useAudioAnalyser] Audio routing: source -> analyser, source -> gain -> destination');
      } catch (error) {
        console.error('[useAudioAnalyser] Failed to connect gain node:', error);
        // if connect fails, fall back to letting the <audio> element output directly
        if (connectedGain) {
          if (connectedGain.disconnect) connectedGain.disconnect();
          connectedGain = null;
        }
      }
    }

    // ensure AudioContext resumes on user interaction (play) — many browsers block autoplay
    const resume = () => {
      console.log('[useAudioAnalyser] Resume triggered, current state:', audioCtx.state);
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          console.log('[useAudioAnalyser] AudioContext resumed successfully');
        }).catch((error) => {
          console.error('[useAudioAnalyser] Failed to resume AudioContext:', error);
        });
      }
    };
    audioEl.addEventListener('play', resume);

    return () => {
      console.log('[useAudioAnalyser] Cleanup');
      audioEl.removeEventListener('play', resume);
      if (sourceRef.current && sourceRef.current.disconnect) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (connectedGain && connectedGain.disconnect) {
        connectedGain.disconnect();
      }
      if (analyser && analyser.disconnect) {
        analyser.disconnect();
      }
      analyserRef.current = null;
    };
  }, [audioRef, nSamples]);

  const pull = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return dataRef.current;
    const tmp = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(tmp);
    // copy first nSamples
    dataRef.current.set(tmp.subarray(0, dataRef.current.length));
    return dataRef.current;
  }, []);

  return { dataRef, pull, analyserRef } as const;
}
