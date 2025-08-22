import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import { AudioControls } from './Components/AudioControls';
import { Woscope } from './Components/Woscope';
import { useState } from 'react';

function App() {
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  return (
    <>
      <div className='w-full h-screen flex items-center justify-center bg-black'>
        <div className='flex flex-col items-center space-y-6'>
          {/* Woscope oscilloscope visualization */}
          <div className='w-96 h-96 border border-green-500 rounded-md overflow-hidden bg-black'>
            <Woscope audioElement={audioElement} />
          </div>

          {/* Audio controls */}
          <AudioControls onAudioRef={setAudioElement} />
        </div>
      </div>

      {/* React Three Fiber Canvas for 3D rendering */}
      <Canvas style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none' 
      }}>
        <View.Port />
      </Canvas>
    </>
  );
}

export default App;
