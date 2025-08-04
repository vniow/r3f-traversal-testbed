import { Sphere } from "@react-three/drei";
import { getInterpolatedPoints } from "./vertexUtils";
import type { ObjectWithVertices } from "./vertexUtils";

// Component to render interpolated points as spheres
export function InterpolatedPoints({ objects }: { objects: ObjectWithVertices[] }) {
  const interpPoints = getInterpolatedPoints(objects);
  return (
    <>
      {interpPoints.map(pt => (
        <Sphere key={pt.key} args={[0.005, 8, 8]} position={pt.position}>
          <meshBasicMaterial attach="material" color={`rgb(${pt.color[0]*255},${pt.color[1]*255},${pt.color[2]*255})`} />
        </Sphere>
      ))}
    </>
  );
}
