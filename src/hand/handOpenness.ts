import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  averagePoint,
  distance3D,
  dotNormalized,
  estimatePalmScale,
  smoothstep,
} from './handMath';

const PALM_INDICES = [0, 5, 9, 13, 17] as const;

const FINGERS = [
  { mcp: 5, pip: 6, dip: 7, tip: 8, weight: 1 },
  { mcp: 9, pip: 10, dip: 11, tip: 12, weight: 1.08 },
  { mcp: 13, pip: 14, dip: 15, tip: 16, weight: 1 },
  { mcp: 17, pip: 18, dip: 19, tip: 20, weight: 0.92 },
] as const;

export interface HandOpennessResult {
  value: number;
  fingers: readonly [number, number, number, number, number];
  palmScale: number;
}

function getFingerExtension(
  landmarks: readonly NormalizedLandmark[],
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number,
  palmScale: number,
): number {
  const mcp = landmarks[mcpIndex];
  const pip = landmarks[pipIndex];
  const dip = landmarks[dipIndex];
  const tip = landmarks[tipIndex];

  if (!mcp || !pip || !dip || !tip) return 0;

  const directLength = distance3D(mcp, tip);
  const chainLength =
    distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);
  const lengthRatio = directLength / Math.max(chainLength, 0.001);
  const normalizedLength = smoothstep(0.58, 0.94, lengthRatio);

  const proximalAlignment = dotNormalized(mcp, pip, pip, dip);
  const distalAlignment = dotNormalized(pip, dip, dip, tip);
  const straightness = smoothstep(0.25, 0.92, (proximalAlignment + distalAlignment) * 0.5);

  const normalizedReach = smoothstep(0.42, 1.25, directLength / palmScale);
  return normalizedLength * 0.4 + straightness * 0.35 + normalizedReach * 0.25;
}

function getThumbExtension(
  landmarks: readonly NormalizedLandmark[],
  palmScale: number,
): number {
  const cmc = landmarks[1];
  const mcp = landmarks[2];
  const ip = landmarks[3];
  const tip = landmarks[4];
  const middleMcp = landmarks[9];

  if (!cmc || !mcp || !ip || !tip || !middleMcp) return 0;

  const chainLength = distance3D(cmc, mcp) + distance3D(mcp, ip) + distance3D(ip, tip);
  const directRatio = distance3D(cmc, tip) / Math.max(chainLength, 0.001);
  const straightness = (dotNormalized(cmc, mcp, mcp, ip) + dotNormalized(mcp, ip, ip, tip)) * 0.5;
  const palmSeparation = distance3D(tip, middleMcp) / palmScale;

  return (
    smoothstep(0.62, 0.95, directRatio) * 0.35 +
    smoothstep(0.15, 0.9, straightness) * 0.25 +
    smoothstep(0.72, 1.42, palmSeparation) * 0.4
  );
}

/**
 * Produces a continuous, scale-independent estimate instead of classifying a pose.
 * Finger straightness, reach and joint alignment are combined so camera angle or
 * one partially occluded joint has limited influence on the final value.
 */
export function analyzeHandOpenness(
  landmarks: readonly NormalizedLandmark[],
): HandOpennessResult {
  if (landmarks.length < 21) {
    return { value: 0, fingers: [0, 0, 0, 0, 0], palmScale: 0.1 };
  }

  const palmScale = estimatePalmScale(landmarks);
  const palmCenter = averagePoint(landmarks, PALM_INDICES);
  const thumb = getThumbExtension(landmarks, palmScale);
  const fingerValues = FINGERS.map(({ mcp, pip, dip, tip }) => {
    const extension = getFingerExtension(landmarks, mcp, pip, dip, tip, palmScale);
    const tipLandmark = landmarks[tip];
    const reachFromPalm = tipLandmark
      ? smoothstep(0.62, 1.72, distance3D(tipLandmark, palmCenter) / palmScale)
      : 0;
    return extension * 0.72 + reachFromPalm * 0.28;
  }) as [number, number, number, number];

  const weights = [0.68, ...FINGERS.map((finger) => finger.weight)];
  const values = [thumb, ...fingerValues] as [number, number, number, number, number];
  let weightedValue = 0;
  let totalWeight = 0;

  for (let index = 0; index < values.length; index += 1) {
    const weight = weights[index] ?? 1;
    weightedValue += (values[index] ?? 0) * weight;
    totalWeight += weight;
  }

  return {
    value: smoothstep(0.08, 0.94, weightedValue / totalWeight),
    fingers: values,
    palmScale,
  };
}

export function getHandOpenness(landmarks: readonly NormalizedLandmark[]): number {
  return analyzeHandOpenness(landmarks).value;
}
