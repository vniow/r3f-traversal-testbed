// Simplified stub for collectVertexScreenData

import type { ObjectWithVertices } from "./vertexUtils";
import type { Camera } from "three";

export interface VertexScreenData {
  screenX: number;
  screenY: number;
  screenZ: number;
  r: number;
  g: number;
  b: number;
}

export function collectVertexScreenData(_objects: ObjectWithVertices[], _camera: Camera) {
  void _objects;
  void _camera;
  return { data: [] as VertexScreenData[], source: [] as ("object" | "interpolated")[] };
}
