import { View, Line, OrthographicCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import { Color } from "three";
import React from "react";

interface WaveformGraphProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  source?: ("object" | "interpolated")[];
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

export function WaveformGraph({ data, width = 600, height = 120, color = "#00ff99", source }: WaveformGraphProps) {
  const points = React.useMemo(() => getWaveformPoints(data, width, height), [data, width, height]);
  const [hovered, setHovered] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; source?: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate reference line positions with 10px margins
  const availableHeight = height - 20;
  const halfHeight = availableHeight / 2;

  // Mouse event handlers for interactivity
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find closest point (in screen space)
    let minDist = 12; // px threshold
    let closestIdx: number | null = null;
    let closestPt: [number, number, number] | null = null;
    points.forEach((pt, i) => {
      // Map graph coordinates to screen
      const px = ((pt[0] + width / 2) / width) * rect.width;
      const py = ((halfHeight - pt[1]) / (2 * halfHeight)) * (rect.height - 20) + 10;
      const dist = Math.sqrt((px - mouseX) ** 2 + (py - mouseY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
        closestPt = pt;
      }
    });
    if (closestIdx !== null && closestPt) {
      setHoveredPoint(closestIdx);
      setTooltip({
        x: ((closestPt[0] + width / 2) / width) * rect.width,
        y: ((halfHeight - closestPt[1]) / (2 * halfHeight)) * (rect.height - 20) + 10,
        value: data[closestIdx],
        source: source && source[closestIdx] ? source[closestIdx] : undefined,
      });
    } else {
      setHoveredPoint(null);
      setTooltip(null);
    }
    setHovered(true);
  }

  function handleMouseLeave() {
    setHovered(false);
    setHoveredPoint(null);
    setTooltip(null);
  }

  // Highlight color for line
  const highlightColor = hovered ? "#fff" : color;

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: height, marginTop: 8, position: "relative", cursor: hovered ? "pointer" : "default" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top-right label for number of points */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 10,
          background: "rgba(40,40,40,0.85)",
          color: "#bbb",
          fontSize: 12,
          padding: "1px 8px",
          borderRadius: 8,
          zIndex: 20,
          pointerEvents: "none",
          fontFamily: "monospace",
          letterSpacing: 0.5,
        }}
      >
        {points.length} pt{points.length === 1 ? "" : "s"}
      </div>
      <View style={{ width: "100%", height: "100%" }}>
        <WaveformBackground />
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={1} />
        <ambientLight intensity={0.5} />
        {points.length > 1 && <Line points={points} color={highlightColor} lineWidth={hovered ? 3 : 2} />}

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

        {/* Draw hovered point marker */}
        {hoveredPoint !== null && points[hoveredPoint] && (
          <>
            {/* Use a small circle marker using a short Line in a cross shape, color depends on source */}
            <Line
              points={[
                [points[hoveredPoint][0] - 3, points[hoveredPoint][1], 0],
                [points[hoveredPoint][0] + 3, points[hoveredPoint][1], 0],
              ]}
              color={source && source[hoveredPoint] === "interpolated" ? "#ff0" : "#fff"}
              lineWidth={2}
            />
            <Line
              points={[
                [points[hoveredPoint][0], points[hoveredPoint][1] - 3, 0],
                [points[hoveredPoint][0], points[hoveredPoint][1] + 3, 0],
              ]}
              color={source && source[hoveredPoint] === "interpolated" ? "#ff0" : "#fff"}
              lineWidth={2}
            />
          </>
        )}
        {/* Draw all interpolated points as small yellow dots, object points as white dots */}
        {source &&
          points.map((pt, i) => (
            <Line
              key={"pt-" + i}
              points={[
                [pt[0] - 1.5, pt[1], 0],
                [pt[0] + 1.5, pt[1], 0],
              ]}
              color={source[i] === "interpolated" ? "#ff0" : "#fff"}
              lineWidth={1}
            />
          ))}
      </View>
      {/* Tooltip overlay */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 8,
            top: tooltip.y - 24,
            background: "rgba(30,30,30,0.95)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 13,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {tooltip.value.toFixed(4)}
          {tooltip.source && (
            <span style={{ marginLeft: 8, color: tooltip.source === "interpolated" ? "#ff0" : "#fff", fontWeight: 600 }}>
              {tooltip.source === "interpolated" ? "interpolated" : "object"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
