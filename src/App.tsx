import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import { AudioControls } from './Components/AudioControls';

function App() {
  return (
    <>
      <div className='flex flex-row items-start w-full h-screen'>
        <AudioControls />
      </div>

      <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <View.Port />
      </Canvas>
    </>
  );
}

export default App;
