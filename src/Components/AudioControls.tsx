import { Woscope } from './Woscope';

export function AudioControls() {
  return (
    <div className='space-y-4'>
      <div className='text-white'>test</div>

      {/* Audio playback for demo */}
      <div>
        <audio
          controls
          className='w-80'
          src='https://raw.githubusercontent.com/m1el/woscope-music/master/alpha_molecule.mp3'
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* Bordered container so the Woscope stands out on the dark background */}
      <div className='border border-gray-600 rounded-md overflow-hidden w-128 h-128'>
        <Woscope />
      </div>
    </div>
  );
}
