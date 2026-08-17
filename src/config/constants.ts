export const DEBUG_HAND_TRACKING = false;

export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

export const TRACKING_MAX_FPS = 30;
export const HAND_LOST_TIMEOUT_MS = 180;

// The model receives the unmirrored camera frame while the preview is mirrored.
export const SWAP_MEDIAPIPE_HANDEDNESS = true;

export const NEUTRAL_INTERACTION = {
  openness: 0.72,
  x: 0.5,
  y: 0.5,
  z: 0.35,
} as const;

export const GALAXY = {
  minParticles: 10_000,
  defaultParticles: 15_000,
  maxParticles: 20_000,
  radius: 20,
  branches: 5,
  spin: 1.42,
  randomness: 0.42,
  distantStars: 1_700,
  minScale: 0.15,
  maxScale: 1.15,
} as const;

export const SOLAR_WORLD = {
  revealHalfLife: 0.24,
  zoomHalfLife: 0.13,
  maximumZoom: 0.9,
} as const;
