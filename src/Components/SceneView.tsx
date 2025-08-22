import { View, OrthographicCamera } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

// SceneView no longer accepts props in the simplified app.

function RotatingBox() {
  const ref = useRef<Mesh | null>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.5;
      ref.current.rotation.y += delta * 0.7;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <mesh ref={ref}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color='orange' />
      </mesh>
    </group>
  );
}

export function SceneView() {
  return (
    <View style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={50} />
      <RotatingBox />
    </View>
  );
}
