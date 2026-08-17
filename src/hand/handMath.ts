import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function inverseLerp(minimum: number, maximum: number, value: number): number {
  if (minimum === maximum) return 0;
  return clamp((value - minimum) / (maximum - minimum));
}

export function distance3D(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function dotNormalized(
  aStart: Point3D,
  aEnd: Point3D,
  bStart: Point3D,
  bEnd: Point3D,
): number {
  const ax = aEnd.x - aStart.x;
  const ay = aEnd.y - aStart.y;
  const az = aEnd.z - aStart.z;
  const bx = bEnd.x - bStart.x;
  const by = bEnd.y - bStart.y;
  const bz = bEnd.z - bStart.z;
  const denominator = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);

  if (denominator < Number.EPSILON) return 0;
  return clamp((ax * bx + ay * by + az * bz) / denominator, -1, 1);
}

export function averagePoint(
  landmarks: readonly NormalizedLandmark[],
  indices: readonly number[],
): Point3D {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const index of indices) {
    const landmark = landmarks[index];
    if (!landmark) continue;
    x += landmark.x;
    y += landmark.y;
    z += landmark.z;
  }

  const divisor = Math.max(indices.length, 1);
  return { x: x / divisor, y: y / divisor, z: z / divisor };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = inverseLerp(edge0, edge1, value);
  return t * t * (3 - 2 * t);
}

export function estimatePalmScale(landmarks: readonly NormalizedLandmark[]): number {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];

  if (!wrist || !middleMcp || !indexMcp || !pinkyMcp) return 0.1;

  const palmLength = distance3D(wrist, middleMcp);
  const palmWidth = distance3D(indexMcp, pinkyMcp);
  return Math.max((palmLength + palmWidth) * 0.5, 0.001);
}
