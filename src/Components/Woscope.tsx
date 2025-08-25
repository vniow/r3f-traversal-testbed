import { View, OrthographicCamera } from '@react-three/drei';
import { useState, useEffect, useRef } from 'react';
import { useAudioBuffer } from '../hooks/useAudioBuffer';
import { WoscopeRenderer } from './WoscopeRenderer';
import { createXYConfig } from '../utils/woscopeVertexUtils';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';

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

  // Track audio playback state from external audio element
  useEffect(() => {
    const audio = audioElement;
    if (!audio) {
      console.log('[Woscope] No audio element provided');
      return;
    }

    console.log('[Woscope] Audio element connected:', audio.src);

    const handlePlay = () => {
      console.log('[Woscope] Audio play event');
      setIsPlaying(true);
    };
    const handlePause = () => {
      console.log('[Woscope] Audio pause event');
      setIsPlaying(false);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioElement]);

  // sync the external audio element into our local ref used by the analyser hook
  useEffect(() => {
    audioRef.current = audioElement || null;
  }, [audioElement]);

  // Configuration for XY mode (Lissajous patterns)
  const woscopeConfig = createXYConfig({
    nSamples: 512, // Smaller for smooth real-time rendering
    amplitudeScale: 2.0, // Boost for visibility
  });

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
            config={woscopeConfig}
          />
        ) : (
          // Loading or error state
          <mesh>
            <planeGeometry args={[2, 0.1]} />
            <meshBasicMaterial color={error ? 'red' : 'gray'} transparent opacity={0.5} />
          </mesh>
        )}

        {/* Ambient lighting for any 3D elements */}
        <ambientLight intensity={0.2} />
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
