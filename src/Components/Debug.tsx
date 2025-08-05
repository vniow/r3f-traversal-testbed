import React from "react";
import "../App.css";
import { WaveformGraph } from "./WaveformGraph";

const debugStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 16px",
  fontFamily: "monospace",

  fontSize: "14px",
};

interface DebugProps {
  vertexData: {
    screenX: number[];
    screenY: number[];
    screenZ: number[];
    r: number[];
    g: number[];
    b: number[];
  };
}

const Debug: React.FC<DebugProps> = ({ vertexData }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(600);

  React.useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return (
    <div style={debugStyle} ref={containerRef}>
      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888" }}>Screen X (NDC)</div> */}
      <WaveformGraph data={vertexData.screenX} width={width} color='#00ff99' />

      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888", marginTop: 16 }}>Screen Y (NDC)</div> */}
      <WaveformGraph data={vertexData.screenY} width={width} color='#ff9900' />

      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888", marginTop: 16 }}>Screen Z (NDC)</div> */}
      <WaveformGraph data={vertexData.screenZ} width={width} color='#9900ff' />

      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888", marginTop: 16 }}>Red Values</div> */}
      <WaveformGraph data={vertexData.r} width={width} color='#ff0000' />

      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888", marginTop: 16 }}>Green Values</div> */}
      <WaveformGraph data={vertexData.g} width={width} color='#00ff00' />

      {/* <div style={{ marginBottom: 8, fontSize: 12, color: "#888", marginTop: 16 }}>Blue Values</div> */}
      <WaveformGraph data={vertexData.b} width={width} color='#0099ff' />
    </div>
  );
};

export default Debug;
