import { useRef } from 'react';

interface AudioControlsProps {
  onAudioRef?: (ref: HTMLAudioElement | null) => void;
}

export function AudioControls({ onAudioRef }: AudioControlsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAudioRef = (element: HTMLAudioElement | null) => {
    audioRef.current = element;
    if (onAudioRef) {
      onAudioRef(element);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='text-white text-center text-sm'>
        Woscope Oscilloscope Visualization
      </div>

      {/* Audio playback controls */}
      <div className='flex justify-center'>
        <audio
          ref={handleAudioRef}
          controls
          className='w-80'
          src='/alpha_molecule.mp3'
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      <div className='text-xs text-gray-400 text-center max-w-80 mx-auto'>
        The visualization above shows the stereo audio as an XY oscilloscope pattern. 
        Left channel = X axis, Right channel = Y axis.
      </div>
    </div>
  );
}
