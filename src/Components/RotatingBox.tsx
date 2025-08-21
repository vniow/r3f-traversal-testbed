import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { View } from "@react-three/drei";
import * as THREE from "three";

export function RotatingBox() {
  const ref = useRef<THREE.Mesh | null>(null);
  // create a ref that satisfies the View.track prop type (RefObject<HTMLElement>)
  const portRef = useRef<HTMLDivElement | null>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.6;
      ref.current.rotation.y += delta * 0.9;
    }
  });

  return (
    // Render inside a Drei View so this component lands in the Canvas's View.Port
    <View track={portRef as unknown as React.RefObject<HTMLElement>}>
      <mesh ref={ref} position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={0x44aa88} />
      </mesh>
    </View>
  );
}

export default RotatingBox;
