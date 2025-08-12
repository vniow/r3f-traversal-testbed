import React from "react";
import "../App.css";
import { View, OrthographicCamera } from "@react-three/drei";
import { Color, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from "three";
import { useThree } from "@react-three/fiber";

// NOTE: We keep the old WaveformGraph component for potential reuse elsewhere,
// but this GraphView now renders all waveforms inside a single drei <View>
// to reduce render passes and improve performance.

const GraphViewStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontFamily: "monospace",

  fontSize: "14px",
};

interface GraphViewProps {
  vertexData: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
    source?: ("object" | "interpolated")[];
  };
}

// Map data values to 2D points ( -1..1 -> vertical span within a row )
function buildPoints(data: number[], width: number, rowHeight: number): [number, number, number][] {
  if (!data || data.length < 2) return [];
  const availableHeight = rowHeight - 20; // mimic old 10px top/bottom margin
  const halfHeight = availableHeight / 2;
  return data.map((v, i) => [(i / (data.length - 1)) * width - width / 2, v * halfHeight, 0] as [number, number, number]);
}

function BackgroundOnce() {
  const { scene } = useThree();
  React.useLayoutEffect(() => {
    scene.background = new Color("#111111");
  }, [scene]);
  return null;
}

function GraphView({ vertexData }: GraphViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(600);
  const rowHeight = 120; // keep parity with old WaveformGraph default height
  const rows = React.useMemo(
    () => [
      { key: "screenX", label: "screenX", color: "#00ff99", data: vertexData.screenX },
      { key: "screenY", label: "screenY", color: "#ff9900", data: vertexData.screenY },
      { key: "screenZ", label: "screenZ", color: "#9900ff", data: vertexData.screenZ },
      { key: "r", label: "r", color: "#ff0000", data: vertexData.r },
      { key: "g", label: "g", color: "#00ff00", data: vertexData.g },
      { key: "b", label: "b", color: "#0099ff", data: vertexData.b },
    ],
    [vertexData]
  );
  const totalHeight = rows.length * rowHeight;

  React.useEffect(() => {
    const handle = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Precompute all point arrays and layout metadata
  const prepared = React.useMemo(() => {
    return rows.map((r, idx) => {
      const points = buildPoints(r.data, width, rowHeight);
      const availableHeight = rowHeight - 20;
      const halfHeight = availableHeight / 2;
      // Position rows from top to bottom; top row center y = totalHeight/2 - rowHeight/2 - idx*rowHeight
      const centerY = totalHeight / 2 - rowHeight / 2 - idx * rowHeight;
      return { ...r, points, centerY, halfHeight };
    });
  }, [rows, width, rowHeight, totalHeight]);

  // Consolidated geometries refs
  const refLinesGeom = React.useRef<BufferGeometry | null>(null);
  const refLinesMat = React.useRef<LineBasicMaterial | null>(null);
  const markersGeom = React.useRef<BufferGeometry | null>(null);
  const markersMat = React.useRef<LineBasicMaterial | null>(null);
  const waveformGeom = React.useRef<BufferGeometry | null>(null);
  const waveformMat = React.useRef<LineBasicMaterial | null>(null);

  // Build / update reference lines geometry (all rows) -> 3 lines per row (0, +1, -1)
  React.useEffect(() => {
    const rowsCount = prepared.length;
    if (!rowsCount) return;
    const segmentsPerRow = 3; // center, +1, -1
    const verticesPerSegment = 2;
    const floatsPerVertex = 3;
    const totalVertices = rowsCount * segmentsPerRow * verticesPerSegment;
    const positions = new Float32Array(totalVertices * floatsPerVertex);
    let offset = 0;
    prepared.forEach(r => {
      // Center line
      positions[offset++] = -width / 2;
      positions[offset++] = r.centerY;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = r.centerY;
      positions[offset++] = 0;
      // Top line (+1)
      positions[offset++] = -width / 2;
      positions[offset++] = r.centerY + r.halfHeight;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = r.centerY + r.halfHeight;
      positions[offset++] = 0;
      // Bottom line (-1)
      positions[offset++] = -width / 2;
      positions[offset++] = r.centerY - r.halfHeight;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = r.centerY - r.halfHeight;
      positions[offset++] = 0;
    });
    if (!refLinesGeom.current) refLinesGeom.current = new BufferGeometry();
    refLinesGeom.current.setAttribute("position", new Float32BufferAttribute(positions, 3));
    if (!refLinesMat.current) refLinesMat.current = new LineBasicMaterial({ color: 0x444444 });
  }, [prepared, width]);

  // Build / update point markers (short horizontal segments) consolidated
  React.useEffect(() => {
    if (!vertexData.source) {
      markersGeom.current = null;
      return;
    }
    // Each row replicates markers for its points (consistent with previous behavior)
    // tiny segment length 3 (same as before total 3 units width) -> we reuse +/-1.5 logic
    const segmentHalf = 1.5;
    // Count total markers
    const totalMarkers = prepared.reduce((sum, r) => sum + r.points.length, 0);
    if (!totalMarkers) return;
    const positions = new Float32Array(totalMarkers * 2 * 3); // 2 vertices per marker
    const colors = new Float32Array(totalMarkers * 2 * 3); // per-vertex RGB
    let offsetPos = 0;
    let offsetCol = 0;
    prepared.forEach(r => {
      r.points.forEach((pt, i) => {
        const isInterp = vertexData.source && vertexData.source[i] === "interpolated";
        const col = isInterp ? [1, 1, 0] : [1, 1, 1];
        const y = pt[1] + r.centerY;
        const xL = pt[0] - segmentHalf;
        const xR = pt[0] + segmentHalf;
        // left vertex
        positions[offsetPos++] = xL;
        positions[offsetPos++] = y;
        positions[offsetPos++] = 0;
        colors[offsetCol++] = col[0];
        colors[offsetCol++] = col[1];
        colors[offsetCol++] = col[2];
        // right vertex
        positions[offsetPos++] = xR;
        positions[offsetPos++] = y;
        positions[offsetPos++] = 0;
        colors[offsetCol++] = col[0];
        colors[offsetCol++] = col[1];
        colors[offsetCol++] = col[2];
      });
    });
    if (!markersGeom.current) markersGeom.current = new BufferGeometry();
    markersGeom.current.setAttribute("position", new Float32BufferAttribute(positions, 3));
    markersGeom.current.setAttribute("color", new Float32BufferAttribute(colors, 3));
    if (!markersMat.current) markersMat.current = new LineBasicMaterial({ vertexColors: true, linewidth: 1 });
  }, [prepared, vertexData.source]);

  // Build / update consolidated waveform geometry (all rows' polylines -> segments)
  React.useEffect(() => {
    // Count total segments across rows
    let totalSegments = 0;
    prepared.forEach(r => {
      if (r.points.length > 1) totalSegments += r.points.length - 1;
    });
    if (totalSegments === 0) {
      waveformGeom.current = null;
      return;
    }
    const positions = new Float32Array(totalSegments * 2 * 3); // 2 vertices per segment
    const colors = new Float32Array(totalSegments * 2 * 3);
    let posOffset = 0;
    let colOffset = 0;
    prepared.forEach(r => {
      if (r.points.length < 2) return;
      // Convert hex color to linear rgb (approx just using sRGB values)
      const c = new Color(r.color);
      const cr = c.r,
        cg = c.g,
        cb = c.b;
      for (let i = 0; i < r.points.length - 1; i++) {
        const p1 = r.points[i];
        const p2 = r.points[i + 1];
        // First vertex
        positions[posOffset++] = p1[0];
        positions[posOffset++] = p1[1] + r.centerY;
        positions[posOffset++] = 0;
        colors[colOffset++] = cr;
        colors[colOffset++] = cg;
        colors[colOffset++] = cb;
        // Second vertex
        positions[posOffset++] = p2[0];
        positions[posOffset++] = p2[1] + r.centerY;
        positions[posOffset++] = 0;
        colors[colOffset++] = cr;
        colors[colOffset++] = cg;
        colors[colOffset++] = cb;
      }
    });
    if (!waveformGeom.current) waveformGeom.current = new BufferGeometry();
    waveformGeom.current.setAttribute("position", new Float32BufferAttribute(positions, 3));
    waveformGeom.current.setAttribute("color", new Float32BufferAttribute(colors, 3));
    if (!waveformMat.current) waveformMat.current = new LineBasicMaterial({ vertexColors: true, linewidth: 2 });
  }, [prepared]);

  return (
    <div style={{ ...GraphViewStyle, position: "relative" }} ref={containerRef}>
      {/* Overlay labels */}
      {prepared.map((r, idx) => (
        <div
          key={r.key + "-label"}
          style={{
            position: "absolute",
            top: idx * rowHeight + 4,
            left: 8,
            fontSize: 11,
            letterSpacing: 0.5,
            color: "#aaa",
            fontFamily: "monospace",
            pointerEvents: "none",
          }}
        >
          {r.label} ({r.points.length})
        </div>
      ))}
      <View style={{ width: "100%", height: totalHeight }}>
        <BackgroundOnce />
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={1} />
        {/* Consolidated reference lines */}
        {refLinesGeom.current && refLinesMat.current && <primitive object={new LineSegments(refLinesGeom.current, refLinesMat.current)} />}
        {/* Consolidated point markers */}
        {markersGeom.current && markersMat.current && <primitive object={new LineSegments(markersGeom.current, markersMat.current)} />}
        {/* Consolidated waveform segments */}
        {waveformGeom.current && waveformMat.current && <primitive object={new LineSegments(waveformGeom.current, waveformMat.current)} />}
      </View>
      {/* Spacer to reserve height so outer layout accounts for total graph height */}
      <div style={{ height: totalHeight }} />
    </div>
  );
}

export default GraphView;
