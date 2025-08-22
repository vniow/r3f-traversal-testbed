import { useRef } from 'react';




export function AudioControls() {
  const audioRef = useRef<HTMLAudioElement | null>(null);


  return (
    <div className='space-y-4'>
      <div className='text-white'>test</div>

      {/* Audio playback for demo */}
      <div>
        <audio
          ref={audioRef}
          controls
          className='w-80'
          src='/alpha_molecule.mp3'
        >
          Your browser does not support the audio element.
        </audio>
      </div>


    </div>
  );
}
