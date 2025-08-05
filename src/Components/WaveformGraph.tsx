import { View, Line, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { Color } from "three";
import React from "react";

interface WaveformGraphProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function WaveformBackground() {
  const { scene } = useThree();
  useLayoutEffect(() => {
    scene.background = new Color("#111111");
  }, [scene]);
  return null;
}

// Map data values to 2D points for the Line
function getWaveformPoints(data: number[], width: number, height: number): [number, number, number][] {
  if (data.length < 2) return [];
  // Calculate available height with 10px margins (top and bottom)
  const availableHeight = height - 20;
  const halfHeight = availableHeight / 2;

  return data.map(
    (v, i) =>
      [
        (i / (data.length - 1)) * width - width / 2, // x: center at 0
        v * halfHeight, // y: scale to fit within margins (-1 to 1 maps to -halfHeight to +halfHeight)
        0,
      ] as [number, number, number]
  );
}

export function WaveformGraph({ data, width = 600, height = 120, color = "#00ff99" }: WaveformGraphProps) {
  const points = React.useMemo(() => getWaveformPoints(data, width, height), [data, width, height]);

  // Calculate reference line positions with 10px margins
  const availableHeight = height - 20;
  const halfHeight = availableHeight / 2;

  // Log the z values of the points
  console.log(
    "WaveformGraph - z values:",
    points.map(p => p[2])
  );

  return (
    <div style={{ width: "100%", height: height, marginTop: 8 }}>
      <View style={{ width: "100%", height: "100%" }}>
        <WaveformBackground />
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={1} />
        <ambientLight intensity={0.5} />
        {points.length > 1 && <Line points={points} color={color} lineWidth={2} />}

        {/* Reference grid lines */}
        {/* Center line (0 value) */}
        <Line
          points={[
            [-width / 2, 0, 0],
            [width / 2, 0, 0],
          ]}
          color='#444'
          lineWidth={1}
        />

        {/* Top line (1 value) - 10px from top */}
        <Line
          points={[
            [-width / 2, halfHeight, 0],
            [width / 2, halfHeight, 0],
          ]}
          color='#333'
          lineWidth={1}
        />

        {/* Bottom line (-1 value) - 10px from bottom */}
        <Line
          points={[
            [-width / 2, -halfHeight, 0],
            [width / 2, -halfHeight, 0],
          ]}
          color='#333'
          lineWidth={1}
        />
      </View>
    </div>
  );
}
