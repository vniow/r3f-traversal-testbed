// JSX automatic runtime assumed — no default React import required
import { EffectComposer, Bloom } from '@react-three/postprocessing';

type WoscopeEffectsProps = {
  intensity?: number;
  luminanceThreshold?: number;
  luminanceSmoothing?: number;
  mipmapBlur?: boolean;
};

export function WoscopeEffects({
  intensity = 1.2,
  luminanceThreshold = 0.2,
  luminanceSmoothing = 0.9,
  mipmapBlur = true,
}: WoscopeEffectsProps) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={intensity}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={luminanceSmoothing}
        mipmapBlur={mipmapBlur}
      />
    </EffectComposer>
  );
}

export default WoscopeEffects;
