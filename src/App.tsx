import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import { AudioControls } from './Components/AudioControls';
import { Woscope } from './Components/Woscope';

function App() {
  return (
    <>
      <div className='w-full h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center space-y-6'>
          <div className='w-80 h-80 border border-gray-600 rounded-md overflow-hidden'>
            <Woscope />
          </div>

          <AudioControls />
        </div>
      </div>

      <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <View.Port />
      </Canvas>

    </>
  );
}

export default App;
