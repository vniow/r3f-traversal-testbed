import { Sphere } from "@react-three/drei";
import { getInterpolatedPoints } from "../vertexUtils";
import type { ObjectWithVertices } from "../vertexUtils";

// Component to render interpolated points as spheres
export function InterpolatedPoints({ objects }: { objects: ObjectWithVertices[] }) {
  if (objects.length < 2) return null;
  
  const interpPoints = getInterpolatedPoints(objects[0], objects[1]);
  
  return (
    <>
      {interpPoints.map((point, index) => (
        <Sphere key={`interp-${index}`} args={[0.01, 8, 8]} position={point}>
          <meshBasicMaterial attach="material" color="yellow" />
        </Sphere>
      ))}
    </>
  );
}
