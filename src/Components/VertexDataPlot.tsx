import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type VertexDatum = {
  t: number;
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
};

export function VertexDataPlot({ data }: { data: VertexDatum[] }) {
  return (
    <div style={{ width: "100%", height: 300, background: "#222", color: "#fff", marginBottom: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="t" stroke="#fff" />
          <YAxis stroke="#fff" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="x" stroke="#ff0000" dot={false} />
          <Line type="monotone" dataKey="y" stroke="#00ff00" dot={false} />
          <Line type="monotone" dataKey="z" stroke="#0000ff" dot={false} />
          <Line type="monotone" dataKey="r" stroke="#ff8888" dot={false} />
          <Line type="monotone" dataKey="g" stroke="#88ff88" dot={false} />
          <Line type="monotone" dataKey="b" stroke="#8888ff" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
