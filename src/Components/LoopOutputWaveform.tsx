import { useEffect, useMemo, useRef } from "react";

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
  // Refs to avoid state updates
  const loopStartTimeRef = useRef<number | null>(null);
  const vertexDataRef = useRef<{ [K in ChannelName]: number[] } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Update refs from props
  useEffect(() => {
    audioCtxRef.current = audioContext;
  }, [audioContext]);

  useEffect(() => {
    vertexDataRef.current = dataForRender?.vertexData ?? null;
  }, [dataForRender]);

  useEffect(() => {
    if (loopTick?.t != null) {
      loopStartTimeRef.current = loopTick.t;
    }
  }, [loopTick?.t]);

  // Stable rAF loop reading from refs
  useEffect(() => {
    const draw = () => {
      const vd = vertexDataRef.current;
      const ctx = audioCtxRef.current;
      const loopStartTime = loopStartTimeRef.current;
      if (!vd || !ctx || loopStartTime == null) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      CHANNELS.forEach(name => {
        const canvas = canvasesRef.current[name];
        if (!canvas) return;
        const g = canvas.getContext("2d");
        if (!g) return;

        const arr = vd[name] || [];
        const len = arr.length;
        if (len === 0) {
          g.clearRect(0, 0, canvas.width, canvas.height);
          g.fillStyle = "#111";
          g.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }

        const sr = ctx.sampleRate;
        const elapsedSamples = Math.floor((ctx.currentTime - loopStartTime) * sr);
        const startIndex = ((elapsedSamples % len) + len) % len;

        g.clearRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = "#111";
        g.fillRect(0, 0, canvas.width, canvas.height);

        g.strokeStyle = "#444";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, canvas.height / 2);
        g.lineTo(canvas.width, canvas.height / 2);
        g.stroke();
        g.strokeStyle = "#333";
        g.beginPath();
        g.moveTo(0, 8);
        g.lineTo(canvas.width, 8);
        g.stroke();
        g.beginPath();
        g.moveTo(0, canvas.height - 8);
        g.lineTo(canvas.width, canvas.height - 8);
        g.stroke();

        g.strokeStyle = CHANNEL_COLORS[name];
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < len; i++) {
          const idx = (startIndex + i) % len;
          const v = arr[idx];
          const x = (i / Math.max(1, len - 1)) * canvas.width;
          const y =
            name === "r" || name === "g" || name === "b"
              ? canvas.height - 8 - Math.max(0, Math.min(1, v)) * (canvas.height - 16)
              : canvas.height / 2 - Math.max(-1, Math.min(1, v)) * (canvas.height / 2 - 8);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
