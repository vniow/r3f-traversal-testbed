import { useEffect, useMemo, useRef, useState } from "react";

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

interface Props {
  audioContext: AudioContext | null;
  dataForRender: {
    vertexData: { [K in ChannelName]: number[] } | null;
    gains: Record<string, number>;
    globalGain: number;
  } | null;
  loopTick: { t: number; lengths: Record<string, number> } | null;
  width?: number;
  height?: number;
}

export function LoopOutputWaveform({ audioContext, dataForRender, loopTick, width = 240, height = 240 }: Props) {
  const canvasesRef = useRef<Record<ChannelName, HTMLCanvasElement | null>>({
    screenX: null,
    screenY: null,
    screenZ: null,
    r: null,
    g: null,
    b: null,
  });
  const rafRef = useRef<number | null>(null);
  const [loopStartTime, setLoopStartTime] = useState<number | null>(null);

  // track the most recent loop start time provided by the worklet
  useEffect(() => {
    if (loopTick?.t != null) setLoopStartTime(loopTick.t);
  }, [loopTick]);

  const draw = useMemo(() => {
    const fn = () => {
      const vd = dataForRender?.vertexData;
      if (!vd || !audioContext || loopStartTime == null) {
        rafRef.current = requestAnimationFrame(fn);
        return;
      }

      CHANNELS.forEach(name => {
        const canvas = canvasesRef.current[name];
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const arr = vd[name] || [];
        const len = arr.length;
        if (len === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

        const sr = audioContext.sampleRate;
        const elapsedSamples = Math.floor((audioContext.currentTime - loopStartTime) * sr);
        const startIndex = ((elapsedSamples % len) + len) % len;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.strokeStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(canvas.width, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 8);
        ctx.lineTo(canvas.width, canvas.height - 8);
        ctx.stroke();

        ctx.strokeStyle = CHANNEL_COLORS[name];
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < len; i++) {
          const idx = (startIndex + i) % len;
          const v = arr[idx];
          const x = (i / Math.max(1, len - 1)) * canvas.width;
          const y =
            name === "r" || name === "g" || name === "b"
              ? canvas.height - 8 - Math.max(0, Math.min(1, v)) * (canvas.height - 16)
              : canvas.height / 2 - Math.max(-1, Math.min(1, v)) * (canvas.height / 2 - 8);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(fn);
    };
    return fn;
  }, [audioContext, dataForRender, loopStartTime]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [audioContext, dataForRender, loopStartTime, draw]);

  const grid = useMemo(() => {
    const rowHeight = Math.max(60, Math.floor(height / 6));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CHANNELS.map(name => (
          <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, color: "#bbb", fontFamily: "monospace" }}>{name}</div>
            <canvas
              ref={el => {
                canvasesRef.current[name] = el;
              }}
              width={width}
              height={rowHeight}
              style={{ width: "100%", height: rowHeight, background: "#111", borderRadius: 6, outline: "1px solid #1f1f1f" }}
            />
          </div>
        ))}
      </div>
    );
  }, [width, height]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#ccc" }}>Loop Output (sample-accurate, phase-stable)</div>
      {grid}
    </div>
  );
}
