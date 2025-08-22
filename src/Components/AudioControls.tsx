import { Woscope } from './Woscope';

export function AudioControls() {
  return (
    <div className='space-y-4'>
      <div className='text-white'>test</div>

      {/* Bordered container so the Woscope stands out on the dark background */}
      <div className='border border-gray-600 rounded-md overflow-hidden w-64 h-64'>
        <Woscope />
      </div>
    </div>
  );
}
