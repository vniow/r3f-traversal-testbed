import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments } from "three";

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

// Helpers
const nearestPow2 = (n: number) => {
  // clamp to analyser limits; most browsers support up to 32768 or 65536
  const clamped = Math.max(256, Math.min(32768, n | 0));
  let p = 1;
  while (p < clamped) p <<= 1;
  // choose closer of p/2 and p
  const prev = p >> 1;
  return clamped - prev < p - clamped ? prev : p;
};

// Find a stable positive-going zero(ish) crossing with a minimum slope.
// bytes are 0..255 where ~128 is 0. We search [start, end).
function findTriggerIndex(bytes: Uint8Array, start: number, end: number, threshold = 128, minSlope = 2): number | null {
  const lo = Math.max(0, Math.min(bytes.length - 2, start));
  const hi = Math.max(lo, Math.min(bytes.length - 2, end));
  for (let i = lo; i < hi; i++) {
    const a = bytes[i];
    const b = bytes[i + 1];
    if (a < threshold && b >= threshold && b - a >= minSlope) {
      return i + 1; // start at the sample just after crossing
    }
  }
  return null;
}

interface WorkletWaveformProps {
  audioContext: AudioContext | null;
  audioWorkletNode: AudioWorkletNode | null;
  width?: number; // preferred initial width in world units; will be overridden by container measurement
}

function BackgroundOnce() {
  const { scene } = useThree();
  React.useLayoutEffect(() => {
    scene.background = new Color("#111111");
  }, [scene]);
  return null;
}

export function WorkletWaveform({ audioContext, audioWorkletNode, width = 600 }: WorkletWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState<number>(width);
  const analyzersRef = useRef<Record<ChannelName, AnalyserNode>>({} as Record<ChannelName, AnalyserNode>);
  const dataLenRef = useRef<Record<ChannelName, number>>({} as Record<ChannelName, number>);
  // const sampleRateRef = useRef<number>(48000); // reserved for future use
  const timeDataRef = useRef<Record<ChannelName, Uint8Array>>({} as Record<ChannelName, Uint8Array>);
  const posArrayRef = useRef<Float32Array | null>(null);

  // Match GraphView: fixed row height of 120px, 6 rows
  const rowHeight = 120;
  const totalHeight = rowHeight * CHANNELS.length;
  const availableHeight = rowHeight - 20;
  const halfHeight = availableHeight / 2;

  // Measure container width like GraphView
  useEffect(() => {
    const update = () => {
      if (containerRef.current) setViewWidth(containerRef.current.offsetWidth || width);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width]);

  // Set up analyzers
  const rebuildWaveGeometry = useCallback(() => {
    // compute per-channel segments and offsets
    let totalSegments = 0;
    CHANNELS.forEach(name => {
      const an = analyzersRef.current[name];
      const bufferLength = an?.fftSize ?? 0;
      const loopLen = dataLenRef.current[name] ?? 0;
      const windowLen = Math.max(0, Math.min(bufferLength, loopLen));
      const segs = windowLen > 1 ? windowLen - 1 : 0;
      totalSegments += segs;
    });
    const pos = new Float32Array(totalSegments * 2 * 3);
    const colors = new Float32Array(totalSegments * 2 * 3);
    let colOff = 0;
    CHANNELS.forEach(name => {
      const an = analyzersRef.current[name];
      const bufferLength = an?.fftSize ?? 0;
      const loopLen = dataLenRef.current[name] ?? 0;
      const windowLen = Math.max(0, Math.min(bufferLength, loopLen));
      const segs = windowLen > 1 ? windowLen - 1 : 0;
      const color = new Color(CHANNEL_COLORS[name]);
      for (let s = 0; s < segs * 2; s++) {
        colors[colOff++] = color.r;
        colors[colOff++] = color.g;
        colors[colOff++] = color.b;
      }
      if (bufferLength > 0) timeDataRef.current[name] = new Uint8Array(bufferLength as number); // ensure standard ArrayBuffer
    });
    if (!waveGeom.current) waveGeom.current = new BufferGeometry();
    waveGeom.current.setAttribute("position", new Float32BufferAttribute(pos, 3));
    waveGeom.current.setAttribute("color", new Float32BufferAttribute(colors, 3));
    if (!waveMat.current) waveMat.current = new LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    posArrayRef.current = pos;
  }, []);

  const init = useCallback(() => {
    if (!audioContext || !audioWorkletNode) return;
    const splitter = audioContext.createChannelSplitter(6);
    audioWorkletNode.connect(splitter);
    CHANNELS.forEach((name, i) => {
      const an = audioContext.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0;
      splitter.connect(an, i);
      analyzersRef.current[name] = an;
    });
    type ChannelInfoMsg = { type: "channelInfo"; lengths: Record<string, number>; sampleRate?: number };
    const handler = (e: MessageEvent) => {
      const msg = e.data as ChannelInfoMsg;
      if (msg && msg.type === "channelInfo") {
        dataLenRef.current = msg.lengths || {};
        for (const name of CHANNELS) {
          const an = analyzersRef.current[name];
          const len = msg.lengths?.[name] ?? 0;
          if (an && len > 0) {
            const want = nearestPow2(len);
            if (an.fftSize !== want) {
              an.fftSize = want;
              an.smoothingTimeConstant = 0;
            }
          }
        }
        rebuildWaveGeometry();
      }
    };
    audioWorkletNode.port.addEventListener("message", handler as EventListener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (audioWorkletNode.port as any).start?.();
    return () => {
      audioWorkletNode.port.removeEventListener("message", handler as EventListener);
    };
  }, [audioContext, audioWorkletNode, rebuildWaveGeometry]);
  // Geometries (consolidated reference grid and waveform segments)
  const refGeom = useRef<BufferGeometry | null>(null);
  const refMat = useRef<LineBasicMaterial | null>(null);
  const waveGeom = useRef<BufferGeometry | null>(null);
  const waveMat = useRef<LineBasicMaterial | null>(null);

  // Build or rebuild reference lines geometry whenever sizing changes
  useEffect(() => {
    const rowsCount = CHANNELS.length;
    const segmentsPerRow = 3;
    const totalVerts = rowsCount * segmentsPerRow * 2;
    const pos = new Float32Array(totalVerts * 3);
    let off = 0;
    CHANNELS.forEach((_, idx) => {
      const centerY = totalHeight / 2 - rowHeight / 2 - idx * rowHeight;
      // center
      pos[off++] = -viewWidth / 2;
      pos[off++] = centerY;
      pos[off++] = 0;
      pos[off++] = viewWidth / 2;
      pos[off++] = centerY;
      pos[off++] = 0;
      // top
      pos[off++] = -viewWidth / 2;
      pos[off++] = centerY + halfHeight;
      pos[off++] = 0;
      pos[off++] = viewWidth / 2;
      pos[off++] = centerY + halfHeight;
      pos[off++] = 0;
      // bottom
      pos[off++] = -viewWidth / 2;
      pos[off++] = centerY - halfHeight;
      pos[off++] = 0;
      pos[off++] = viewWidth / 2;
      pos[off++] = centerY - halfHeight;
      pos[off++] = 0;
    });
    if (!refGeom.current) refGeom.current = new BufferGeometry();
    refGeom.current.setAttribute("position", new Float32BufferAttribute(pos, 3));
    if (!refMat.current) refMat.current = new LineBasicMaterial({ color: 0x444444 });
  }, [viewWidth, rowHeight, halfHeight, totalHeight]);

  // Build or rebuild waveform geometry buffers when analyser sizes or lengths change

  // Rebuild when init or channel info changes or width/height changes (affects y mapping)
  useEffect(() => {
    rebuildWaveGeometry();
  }, [rebuildWaveGeometry, viewWidth, rowHeight]);

  // R3F child that lives inside the View, to run useFrame and render primitives
  function SceneContent() {
    useFrame(() => {
      if (!waveGeom.current || !posArrayRef.current) return;
      const pos = posArrayRef.current;
      let baseVert = 0; // in vertices (2 per segment)
      CHANNELS.forEach((name, idx) => {
        const an = analyzersRef.current[name];
        if (!an) return;
        const timeData = timeDataRef.current[name];
        if (!timeData || timeData.length !== an.fftSize) return;
        an.getByteTimeDomainData(timeData as unknown as Uint8Array<ArrayBuffer>);
        const loopLen = dataLenRef.current[name] || 0;
        const bufferLength = an.fftSize;
        const windowLen = Math.max(0, Math.min(bufferLength, loopLen));
        const segs = windowLen > 1 ? windowLen - 1 : 0;
        const centerY = totalHeight / 2 - rowHeight / 2 - idx * rowHeight;
        // Trigger search in the most recent window
        const searchEnd = bufferLength;
        const searchStart = Math.max(0, searchEnd - windowLen - 64);
        const trigger = findTriggerIndex(timeData, searchStart, searchEnd);
        let start = trigger ?? bufferLength - windowLen;
        if (start + windowLen > bufferLength) start = bufferLength - windowLen;
        if (start < 0) start = 0;

        for (let i = 0; i < segs; i++) {
          const b1 = timeData[start + i];
          const b2 = timeData[start + i + 1];
          const v1 = (b1 - 128) / 128;
          const v2 = (b2 - 128) / 128;
          let y1: number, y2: number;
          if (name === "r" || name === "g" || name === "b") {
            const n1 = (v1 + 1) / 2;
            const n2 = (v2 + 1) / 2;
            y1 = centerY - halfHeight + n1 * (2 * halfHeight);
            y2 = centerY - halfHeight + n2 * (2 * halfHeight);
          } else {
            y1 = centerY + v1 * halfHeight;
            y2 = centerY + v2 * halfHeight;
          }
          const x1 = (i / Math.max(1, windowLen - 1)) * viewWidth - viewWidth / 2;
          const x2 = ((i + 1) / Math.max(1, windowLen - 1)) * viewWidth - viewWidth / 2;
          // write two vertices
          const vtxBase = (baseVert + i * 2) * 3;
          pos[vtxBase + 0] = x1;
          pos[vtxBase + 1] = y1;
          pos[vtxBase + 2] = 0;
          pos[vtxBase + 3] = x2;
          pos[vtxBase + 4] = y2;
          pos[vtxBase + 5] = 0;
        }
        baseVert += segs * 2;
      });
      const attr = waveGeom.current.getAttribute("position") as Float32BufferAttribute | undefined;
      if (attr) attr.needsUpdate = true;
    });
    return (
      <>
        {refGeom.current && refMat.current && <primitive object={new LineSegments(refGeom.current, refMat.current)} />}
        {waveGeom.current && waveMat.current && <primitive object={new LineSegments(waveGeom.current, waveMat.current)} />}
      </>
    );
  }

  useEffect(() => {
    const cleanup = init();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [init]);

  // Overlay labels
  const labels = useMemo(() => CHANNELS.map((name, idx) => ({ name, top: idx * rowHeight + 4 })), [rowHeight]);

  return (
    <div style={{ position: "relative", width: "100%" }} ref={containerRef}>
      {labels.map(l => (
        <div
          key={l.name}
          style={{ position: "absolute", top: l.top, left: 8, fontSize: 11, color: "#bbb", fontFamily: "monospace", pointerEvents: "none" }}
        >
          {l.name}
        </div>
      ))}
      <View style={{ width: "100%", height: totalHeight }}>
        <BackgroundOnce />
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={1} />
        <SceneContent />
      </View>
      <div style={{ height: totalHeight }} />
    </div>
  );
}
