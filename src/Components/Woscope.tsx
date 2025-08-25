import { View, OrthographicCamera } from '@react-three/drei';
import { useState, useEffect, useRef } from 'react';
import { useAudioBuffer } from '../hooks/useAudioBuffer';
import { WoscopeRenderer } from './WoscopeRenderer';
import { createXYConfig, createVertexDataFromAudio, type WoscopeVertexData } from '../utils/woscopeVertexUtils';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';
import WoscopeEffects from './WoscopeEffects';

interface WoscopeProps {
  audioUrl?: string;
  audioElement?: HTMLAudioElement | null;
}

export function Woscope({ audioUrl = '/alpha_molecule.mp3', audioElement }: WoscopeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio buffer data
  const { audioData, loading, error } = useAudioBuffer(audioUrl);

  // Hook up analyser for live per-frame samples
  const { pull: pullAnalysers } = useAudioAnalyser(audioRef, audioData ? Math.min(2048, audioData.leftChannel.length) : 1024);
  // Configuration for XY mode (Lissajous patterns)
  const woscopeConfig = createXYConfig({
    nSamples: 2048,
    amplitudeScale: 2.0, // Boost for visibility
  });

  // frozen vertex snapshot captured on pause
  const [snapshot, setSnapshot] = useState<WoscopeVertexData | null>(null);

  // Track audio playback state from external audio element
  useEffect(() => {
    const audio = audioElement;
    if (!audio) {
      console.log('[Woscope] No audio element provided');
      return;
    }

    console.log('[Woscope] Audio element connected:', audio.src);

    const captureSnapshot = () => {
      try {
        if (audioData && audio) {
          const startSample = Math.floor(audio.currentTime * audioData.sampleRate);
          const snap = createVertexDataFromAudio(audioData.leftChannel, audioData.rightChannel, startSample, woscopeConfig);
          setSnapshot(snap);
        } else if (pullAnalysers) {
          const { left, right } = pullAnalysers();
          // freeze analyser buffers by copying
          const leftCopy = new Float32Array(left);
          const rightCopy = new Float32Array(right);
          const snap = createVertexDataFromAudio(leftCopy, rightCopy, 0, woscopeConfig);
          setSnapshot(snap);
        }
      } catch (err) {
        console.warn('[Woscope] Failed to capture snapshot', err);
      }
    };

    const handlePlay = () => {
      console.log('[Woscope] Audio play event');
      setIsPlaying(true);
      // clear any frozen snapshot when playback resumes
      setSnapshot(null);
    };

    const handlePause = () => {
      console.log('[Woscope] Audio pause event');
      setIsPlaying(false);
      // capture a frozen snapshot of the current window so visuals remain static while paused
      captureSnapshot();
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // if paused while scrubbing, update the frozen snapshot so visuals follow the scrubber
      if (audio.paused) captureSnapshot();
    };

    const handleSeeked = () => {
      setCurrentTime(audio.currentTime);
      if (audio.paused) captureSnapshot();
    };

    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioElement, audioData, pullAnalysers, woscopeConfig]);

  // sync the external audio element into our local ref used by the analyser hook
  useEffect(() => {
    audioRef.current = audioElement || null;
  }, [audioElement]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D oscilloscope view */}
      <View style={{ width: '100%', height: '100%' }}>
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={100} />

        {/* Oscilloscope visualization */}
        {audioData && !loading && !error ? (
          <WoscopeRenderer
            leftChannel={audioData.leftChannel}
            rightChannel={audioData.rightChannel}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={audioData.duration}
            sampleRate={audioData.sampleRate}
            audioElement={audioRef.current}
            analyserPull={pullAnalysers}
            snapshot={snapshot}
            config={woscopeConfig}
          />
        ) : (
          // Loading or error state
          <mesh>
            <planeGeometry args={[2, 0.1]} />
            <meshBasicMaterial color={error ? 'red' : 'gray'} transparent opacity={0.5} />
          </mesh>
        )}

        {/* Built-in bloom + composer */}
        {/* <WoscopeEffects intensity={1.2} luminanceThreshold={0.18} luminanceSmoothing={0.9} /> */}

        {/* Ambient lighting for any 3D elements */}
        <ambientLight intensity={1} />
      </View>

      {/* Status overlay */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          color: 'white',
          fontSize: '12px',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}
      >
        {loading && 'Loading audio...'}
        {error && `Error: ${error}`}
        {audioData && !loading && !error && (
          <div>
            {isPlaying ? '▶' : '⏸'} {Math.round(currentTime)}s / {Math.round(audioData.duration)}s
            <br />
            {audioData.rightChannel.length.toLocaleString()} samples
          </div>
        )}
      </div>
    </div>
  );
}
