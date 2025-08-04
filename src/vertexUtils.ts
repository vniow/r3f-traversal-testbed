import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import type { Camera } from "three";

export interface ObjectWithVertices {
  name: string;
  points: [number, number, number][];
  colors: [number, number, number][];
}

export interface VertexData {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  screenX: number;
  screenY: number;
}

export function getInterpolatedPoints(
  obj1: ObjectWithVertices,
  obj2: ObjectWithVertices,
  interpolationSteps: number = 5
): [number, number, number][] {
  const interpolatedPoints: [number, number, number][] = [];
  
  const minLength = Math.min(obj1.points.length, obj2.points.length);
  
  for (let i = 0; i < minLength; i++) {
    const p1 = obj1.points[i];
    const p2 = obj2.points[i];
    
    for (let step = 1; step <= interpolationSteps; step++) {
      const t = step / (interpolationSteps + 1);
      const interpolatedPoint: [number, number, number] = [
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
        p1[2] + (p2[2] - p1[2]) * t,
      ];
      interpolatedPoints.push(interpolatedPoint);
    }
  }
  
  return interpolatedPoints;
}

export function getScreenCoordinates(
  worldPosition: [number, number, number],
  camera: Camera
): { screenX: number; screenY: number } {
  const vector = new Vector3(...worldPosition);
  vector.project(camera);
  
  // Normalize to -1 to 1 range (NDC)
  const screenX = vector.x;
  const screenY = vector.y;
  
  return { screenX, screenY };
}

export function useLogVertices(
  objects: ObjectWithVertices[],
  camera: Camera,
  onVertexData?: (data: VertexData[]) => void
) {
  useFrame(() => {
    const allVertexData: VertexData[] = [];
    
    objects.forEach((obj) => {
      obj.points.forEach((point, index) => {
        const color = obj.colors[index] || [1, 1, 1];
        const { screenX, screenY } = getScreenCoordinates(point, camera);
        
        const vertexData: VertexData = {
          x: point[0],
          y: point[1],
          z: point[2],
          r: color[0],
          g: color[1],
          b: color[2],
          screenX,
          screenY,
        };
        
        allVertexData.push(vertexData);
        
        // console.log(
        //   `Object: ${obj.name}, Vertex ${index}: ` +
        //   `World(${point[0].toFixed(2)}, ${point[1].toFixed(2)}, ${point[2].toFixed(2)}), ` +
        //   `Color(${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)}), ` +
        //   `Screen(${screenX.toFixed(2)}, ${screenY.toFixed(2)})`
        // );
      });
    });
    
    if (onVertexData) {
      onVertexData(allVertexData);
    }
  });
}
