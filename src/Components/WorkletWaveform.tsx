import { useCallback, useEffect, useMemo, useRef } from "react";

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
  width?: number;
  height?: number;
}

export function WorkletWaveform({ audioContext, audioWorkletNode, width = 240, height = 240 }: WorkletWaveformProps) {
  const canvasesRef = useRef<Record<ChannelName, HTMLCanvasElement | null>>({
    screenX: null,
    screenY: null,
    screenZ: null,
    r: null,
    g: null,
    b: null,
  });
  const analyzersRef = useRef<Record<ChannelName, AnalyserNode>>({} as Record<ChannelName, AnalyserNode>);
  const dataLenRef = useRef<Record<ChannelName, number>>({} as Record<ChannelName, number>);
  const sampleRateRef = useRef<number>(48000);
  const rafRef = useRef<number | null>(null);

  // Set up analyzers
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
        if (msg.sampleRate) sampleRateRef.current = msg.sampleRate;
        // Align each analyser's window to its loop length (nearest power-of-two)
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
      }
    };
    audioWorkletNode.port.addEventListener("message", handler as EventListener);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (audioWorkletNode.port as any).start?.();

    return () => {
      audioWorkletNode.port.removeEventListener("message", handler as EventListener);
      // Optional: disconnect splitter/analyzers if you re-init often
    };
  }, [audioContext, audioWorkletNode]);

  // Draw loop with trigger alignment
  const draw = useCallback(() => {
    CHANNELS.forEach(name => {
      const an = analyzersRef.current[name];
      const canvas = canvasesRef.current[name];
      if (!an || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bufferLength = an.fftSize;
      const timeData = new Uint8Array(bufferLength);
      an.getByteTimeDomainData(timeData);

      const loopLen = dataLenRef.current[name] || 0;
      const windowLen = Math.max(0, Math.min(bufferLength, loopLen));
      if (windowLen <= 0) {
        // Clear background and bail
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Clear + background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // grid
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

      // Trigger: find a stable positive zero crossing near the left side of the last window
      const searchEnd = bufferLength; // most recent sample at the right side of buffer
      const searchStart = Math.max(0, searchEnd - windowLen - 64); // small margin
      const trigger = findTriggerIndex(timeData, searchStart, searchEnd);
      // Start drawing at the trigger if found; else draw the most recent window
      let start = trigger ?? bufferLength - windowLen;
      if (start + windowLen > bufferLength) start = bufferLength - windowLen;
      if (start < 0) start = 0;

      // Draw only the loop window
      ctx.strokeStyle = CHANNEL_COLORS[name];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < windowLen; i++) {
        const byte = timeData[start + i];
        // Convert to [-1,1]
        const v = (byte - 128) / 128;
        // For color channels, map to [0,1] visually (same semantics as left graphs)
        const vNorm = name === "r" || name === "g" || name === "b" ? (v + 1) / 2 : v;
        const x = (i / Math.max(1, windowLen - 1)) * canvas.width;
        const y =
          name === "r" || name === "g" || name === "b"
            ? canvas.height - 8 - vNorm * (canvas.height - 16)
            : canvas.height / 2 - vNorm * (canvas.height / 2 - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const cleanup = init();
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (typeof cleanup === "function") cleanup();
    };
  }, [init, draw]);

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
              style={{ width: "100%", height: rowHeight, background: "#111", borderRadius: 6, outline: `1px solid #1f1f1f` }}
            />
          </div>
        ))}
      </div>
    );
  }, [width, height]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, color: "#ccc" }}>Audio Worklet Waveforms (loop only, phase-locked)</div>
      {grid}
    </div>
  );
}
