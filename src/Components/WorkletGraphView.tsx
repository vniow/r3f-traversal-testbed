import React from "react";
import { View, OrthographicCamera } from "@react-three/drei";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments } from "three";
import { useThree } from "@react-three/fiber";

type ChannelName = "screenX" | "screenY" | "screenZ" | "r" | "g" | "b";
const CHANNELS: ChannelName[] = ["screenX", "screenY", "screenZ", "r", "g", "b"];
const CHANNEL_COLORS: Record<ChannelName, string> = {
  screenX: "#00ff99",
  screenY: "#ff9900",
  screenZ: "#9900ff",
  r: "#ff0000",
  g: "#00ff00",
  b: "#0099ff",
};

// Helpers (copied from WorkletWaveform)
const nearestPow2 = (n: number) => {
  const clamped = Math.max(256, Math.min(32768, n | 0));
  let p = 1;
  while (p < clamped) p <<= 1;
  const prev = p >> 1;
  return clamped - prev < p - clamped ? prev : p;
};

function findTriggerIndex(bytes: Uint8Array, start: number, end: number, threshold = 128, minSlope = 2): number | null {
  const lo = Math.max(0, Math.min(bytes.length - 2, start));
  const hi = Math.max(lo, Math.min(bytes.length - 2, end));
  for (let i = lo; i < hi; i++) {
    const a = bytes[i];
    const b = bytes[i + 1];
    if (a < threshold && b >= threshold && b - a >= minSlope) {
      return i + 1;
    }
  }
  return null;
}

const GraphViewStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontFamily: "monospace",
  fontSize: "14px",
};

function BackgroundOnce() {
  const { scene } = useThree();
  React.useLayoutEffect(() => {
    scene.background = new Color("#111111");
  }, [scene]);
  return null;
}

interface WorkletGraphViewProps {
  audioContext: AudioContext | null;
  audioWorkletNode: AudioWorkletNode | null;
}

export function WorkletGraphView({ audioContext, audioWorkletNode }: WorkletGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(600);
  const rowHeight = 120;

  // Analyzer plumbing
  const analyzersRef = useRef<Record<ChannelName, AnalyserNode>>({} as Record<ChannelName, AnalyserNode>);
  const dataLenRef = useRef<Record<ChannelName, number>>({} as Record<ChannelName, number>);
  const rafRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Geometries/materials like GraphView
  const refLinesGeom = useRef<BufferGeometry | null>(null);
  const refLinesMat = useRef<LineBasicMaterial | null>(null);
  const waveformGeom = useRef<BufferGeometry | null>(null);
  const waveformMat = useRef<LineBasicMaterial | null>(null);

  const rows = useMemo(() => CHANNELS.map(ch => ({ key: ch, label: ch, color: CHANNEL_COLORS[ch] })), []);
  const totalHeight = rows.length * rowHeight;

  useEffect(() => {
    const handle = () => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    };
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Initialize analyzers and subscribe to channelInfo messages
  const initAnalyzers = useCallback(() => {
    if (!audioContext || !audioWorkletNode || initializedRef.current) return;
    const splitter = audioContext.createChannelSplitter(6);
    audioWorkletNode.connect(splitter);
    CHANNELS.forEach((name, i) => {
      const an = audioContext.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0;
      splitter.connect(an, i);
      analyzersRef.current[name] = an;
    });

    type ChannelInfoMsg = { type: "channelInfo"; lengths: Record<string, number> };
    const handler = (e: MessageEvent) => {
      const msg = e.data as ChannelInfoMsg;
      if (msg && msg.type === "channelInfo") {
        CHANNELS.forEach(name => {
          const len = msg.lengths?.[name] ?? 0;
          dataLenRef.current[name] = len;
          const an = analyzersRef.current[name];
          if (an && len > 0) {
            const want = nearestPow2(len);
            if (an.fftSize !== want) {
              an.fftSize = want;
              an.smoothingTimeConstant = 0;
            }
          }
        });
      }
    };
    audioWorkletNode.port.addEventListener("message", handler as EventListener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (audioWorkletNode.port as any).start?.();

    initializedRef.current = true;
    return () => {
      audioWorkletNode.port.removeEventListener("message", handler as EventListener);
    };
  }, [audioContext, audioWorkletNode]);

  // Build static reference lines when layout changes
  useEffect(() => {
    const rowsCount = rows.length;
    if (!rowsCount) return;
    const segmentsPerRow = 3;
    const verticesPerSegment = 2;
    const floatsPerVertex = 3;
    const totalVertices = rowsCount * segmentsPerRow * verticesPerSegment;
    const positions = new Float32Array(totalVertices * floatsPerVertex);
    let offset = 0;
    rows.forEach((_, idx) => {
      const centerY = totalHeight / 2 - rowHeight / 2 - idx * rowHeight;
      const halfHeight = (rowHeight - 20) / 2;
      // Center
      positions[offset++] = -width / 2;
      positions[offset++] = centerY;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = centerY;
      positions[offset++] = 0;
      // +1
      positions[offset++] = -width / 2;
      positions[offset++] = centerY + halfHeight;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = centerY + halfHeight;
      positions[offset++] = 0;
      // -1
      positions[offset++] = -width / 2;
      positions[offset++] = centerY - halfHeight;
      positions[offset++] = 0;
      positions[offset++] = width / 2;
      positions[offset++] = centerY - halfHeight;
      positions[offset++] = 0;
    });
    if (!refLinesGeom.current) refLinesGeom.current = new BufferGeometry();
    refLinesGeom.current.setAttribute("position", new Float32BufferAttribute(positions, 3));
    (refLinesGeom.current.getAttribute("position") as Float32BufferAttribute).needsUpdate = true;
    if (!refLinesMat.current) refLinesMat.current = new LineBasicMaterial({ color: 0x444444 });
  }, [rows, width, rowHeight, totalHeight]);

  // Draw/update waveforms into consolidated geometry using RAF
  const draw = useCallback(() => {
    const positionsArrays: number[][] = [];
    const colorsArrays: number[][] = [];
    let totalSegments = 0;
    const drawWidth = Math.max(2, width);

    rows.forEach((row, idx) => {
      const name = row.key as ChannelName;
      const an = analyzersRef.current[name];
      if (!an) return;
      const bufferLength = an.fftSize;
      const timeData = new Uint8Array(bufferLength);
      an.getByteTimeDomainData(timeData);
      const loopLen = dataLenRef.current[name] || 0;
      // Fallback: if loop length not known yet, draw a recent window
      const windowLen = Math.max(0, Math.min(bufferLength, loopLen > 1 ? loopLen : Math.min(bufferLength, 512)));
      if (windowLen <= 0) {
        positionsArrays.push([]);
        colorsArrays.push([]);
        return;
      }
      const searchEnd = bufferLength;
      const searchStart = Math.max(0, searchEnd - windowLen - 64);
      const trigger = findTriggerIndex(timeData, searchStart, searchEnd);
      let start = trigger ?? bufferLength - windowLen;
      if (start + windowLen > bufferLength) start = bufferLength - windowLen;
      if (start < 0) start = 0;

      const centerY = totalHeight / 2 - rowHeight / 2 - idx * rowHeight;
      const halfHeight = (rowHeight - 20) / 2;
      const rowPositions: number[] = [];
      const rowColors: number[] = [];
      const c = new Color(row.color);
      const cr = c.r,
        cg = c.g,
        cb = c.b;

      for (let i = 0; i < windowLen - 1; i++) {
        const a = timeData[start + i];
        const b = timeData[start + i + 1];
        const va = (a - 128) / 128;
        const vb = (b - 128) / 128;
        const vaNorm = name === "r" || name === "g" || name === "b" ? (va + 1) / 2 : va;
        const vbNorm = name === "r" || name === "g" || name === "b" ? (vb + 1) / 2 : vb;
        const x1 = (i / Math.max(1, windowLen - 1)) * drawWidth - drawWidth / 2;
        const y1 = name === "r" || name === "g" || name === "b" ? centerY + vaNorm * halfHeight : centerY + vaNorm * halfHeight;
        const x2 = ((i + 1) / Math.max(1, windowLen - 1)) * drawWidth - drawWidth / 2;
        const y2 = name === "r" || name === "g" || name === "b" ? centerY + vbNorm * halfHeight : centerY + vbNorm * halfHeight;
        // first vertex
        rowPositions.push(x1, y1, 0);
        rowColors.push(cr, cg, cb);
        // second vertex
        rowPositions.push(x2, y2, 0);
        rowColors.push(cr, cg, cb);
      }

      positionsArrays.push(rowPositions);
      colorsArrays.push(rowColors);
      totalSegments += Math.max(0, windowLen - 1);
    });

    if (totalSegments === 0) {
      waveformGeom.current = null;
    } else {
      const totalVerts = totalSegments * 2;
      const positions = new Float32Array(totalVerts * 3);
      const colors = new Float32Array(totalVerts * 3);
      let pOff = 0;
      let cOff = 0;
      for (let r = 0; r < positionsArrays.length; r++) {
        const rp = positionsArrays[r];
        const rc = colorsArrays[r];
        if (!rp || rp.length === 0) continue;
        positions.set(rp, pOff);
        colors.set(rc, cOff);
        pOff += rp.length;
        cOff += rc.length;
      }
      if (!waveformGeom.current) waveformGeom.current = new BufferGeometry();
      waveformGeom.current.setAttribute("position", new Float32BufferAttribute(positions, 3));
      waveformGeom.current.setAttribute("color", new Float32BufferAttribute(colors, 3));
      (waveformGeom.current.getAttribute("position") as Float32BufferAttribute).needsUpdate = true;
      (waveformGeom.current.getAttribute("color") as Float32BufferAttribute).needsUpdate = true;
      if (!waveformMat.current) waveformMat.current = new LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [rows, width, rowHeight, totalHeight]);

  useEffect(() => {
    const cleanup = initAnalyzers();
    // Only start drawing once analyzers exist
    if (Object.keys(analyzersRef.current).length > 0) {
      rafRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (typeof cleanup === "function") cleanup();
    };
  }, [initAnalyzers, draw]);

  return (
    <div style={{ ...GraphViewStyle, position: "relative" }} ref={containerRef}>
      {rows.map((r, idx) => (
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
          {r.label}
        </div>
      ))}
      <View style={{ width: "100%", height: totalHeight }}>
        <BackgroundOnce />
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={1} />
        {refLinesGeom.current && refLinesMat.current && <primitive object={new LineSegments(refLinesGeom.current, refLinesMat.current)} />}
        {waveformGeom.current && waveformMat.current && <primitive object={new LineSegments(waveformGeom.current, waveformMat.current)} />}
      </View>
      <div style={{ height: totalHeight }} />
    </div>
  );
}

export default WorkletGraphView;
