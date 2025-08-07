import { View, OrthographicCamera } from "@react-three/drei";
import { useEffect, useState } from "react";
import { Sphere } from "@react-three/drei";
import { Color } from "three";
import Lights from "./Lights";

// Number of visualized points/vertices
const NUM_POINTS = 5;

// Helper to generate random value in [-1, 1]
function randomValue() {
  return Math.random() * 2 - 1;
}

export function RenderView() {
  // State for analyser values (simulate with random noise)
  const [analyserValues, setAnalyserValues] = useState(
    Array(NUM_POINTS)
      .fill(0)
      .map(() => ({
        x: randomValue(),
        y: randomValue(),
        z: randomValue(),
        r: Math.random(),
        g: Math.random(),
        b: Math.random(),
      }))
  );

  // Update values every frame (simulate audio input)
  useEffect(() => {
    let running = true;
    function update() {
      setAnalyserValues(
        Array(NUM_POINTS)
          .fill(0)
          .map(() => ({
            x: randomValue(),
            y: randomValue(),
            z: randomValue(),
            r: Math.random(),
            g: Math.random(),
            b: Math.random(),
          }))
      );
      if (running) requestAnimationFrame(update);
    }
    update();
    return () => {
      running = false;
    };
  }, []);

  // Map z to luminance (0 = dark, 1 = bright)
  function getLuminance(z: number) {
    // Map z from [-1,1] to [0.2, 1]
    return 0.2 + 0.8 * ((z + 1) / 2);
  }

  return (
    <View style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={50} />
      <Lights />
      {/* Render spheres for each analyser value */}
      {analyserValues.map((val, i) => {
        // Color with luminance
        const lum = getLuminance(val.z);
        const color = new Color(val.r * lum, val.g * lum, val.b * lum);
        return (
          <Sphere key={i} args={[0.08, 16, 16]} position={[val.x * 2, val.y * 2, 0]}>
            <meshStandardMaterial attach='material' color={color} />
          </Sphere>
        );
      })}
    </View>
  );
}
