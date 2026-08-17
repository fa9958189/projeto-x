import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import {
  HAND_MODEL_URL,
  MEDIAPIPE_WASM_URL,
  SWAP_MEDIAPIPE_HANDEDNESS,
  TRACKING_MAX_FPS,
} from '../config/constants';
import { averagePoint, clamp, getPinchAmount } from './handMath';
import { analyzeHandOpenness } from './handOpenness';

export type HandTrackerStatus =
  | 'idle'
  | 'loading-model'
  | 'requesting-camera'
  | 'ready'
  | 'permission-denied'
  | 'camera-unavailable'
  | 'error';

export type HandSide = 'left' | 'right';

export interface TrackedHand {
  side: HandSide;
  confidence: number;
  openness: number;
  pinch: number;
  handX: number;
  handY: number;
  handZ: number;
  landmarks: readonly NormalizedLandmark[];
}

export interface HandTrackingFrame {
  hands: readonly TrackedHand[];
  left: TrackedHand | null;
  right: TrackedHand | null;
}

interface HandTrackerOptions {
  video: HTMLVideoElement;
  onStatusChange: (status: HandTrackerStatus) => void;
  onFrame: (frame: HandTrackingFrame) => void;
}

const NO_HAND_FRAME: HandTrackingFrame = {
  hands: [],
  left: null,
  right: null,
};

function normalizeHandedness(label: string, palmX: number): HandSide {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === 'left' || normalizedLabel === 'right') {
    if (!SWAP_MEDIAPIPE_HANDEDNESS) return normalizedLabel;
    return normalizedLabel === 'left' ? 'right' : 'left';
  }

  return palmX < 0.5 ? 'right' : 'left';
}

export class HandTracker {
  private readonly video: HTMLVideoElement;
  private readonly onStatusChange: (status: HandTrackerStatus) => void;
  private readonly onFrame: (frame: HandTrackingFrame) => void;
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private previousVideoTime = -1;
  private lastDetectionTime = -Infinity;
  private running = false;

  public constructor(options: HandTrackerOptions) {
    this.video = options.video;
    this.onStatusChange = options.onStatusChange;
    this.onFrame = options.onFrame;
  }

  public async start(): Promise<MediaStream> {
    if (this.running && this.stream) return this.stream;

    try {
      this.onStatusChange('loading-model');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const options = {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.52,
        minTrackingConfidence: 0.52,
      } as const;

      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'GPU' },
        });
      } catch {
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        });
      }

      this.onStatusChange('requesting-camera');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Camera API unavailable', 'NotFoundError');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30, max: 60 },
        },
      });

      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      this.onStatusChange('ready');
      return this.stream;
    } catch (error: unknown) {
      this.stop();
      const status = this.getErrorStatus(error);
      this.onStatusChange(status);
      throw error;
    }
  }

  public update(timestampMs: number): void {
    if (
      !this.running ||
      !this.landmarker ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    const interval = 1000 / TRACKING_MAX_FPS;
    if (timestampMs - this.lastDetectionTime < interval || this.video.currentTime === this.previousVideoTime) {
      return;
    }

    this.lastDetectionTime = timestampMs;
    this.previousVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, timestampMs);
    if (result.landmarks.length === 0) {
      this.onFrame(NO_HAND_FRAME);
      return;
    }

    const hands: TrackedHand[] = [];
    for (let index = 0; index < result.landmarks.length; index += 1) {
      const landmarks = result.landmarks[index];
      if (!landmarks) continue;

      const analysis = analyzeHandOpenness(landmarks);
      const palmCenter = averagePoint(landmarks, [0, 5, 9, 13, 17]);
      const category = result.handedness[index]?.[0];
      const side = normalizeHandedness(category?.categoryName ?? '', palmCenter.x);
      const trackedHand: TrackedHand = {
        side,
        confidence: category?.score ?? 0.5,
        openness: analysis.value,
        pinch: getPinchAmount(landmarks, analysis.value),
        handX: clamp(1 - palmCenter.x),
        handY: clamp(palmCenter.y),
        handZ: clamp((analysis.palmScale - 0.07) / 0.2),
        landmarks,
      };

      const duplicateIndex = hands.findIndex((hand) => hand.side === side);
      if (duplicateIndex === -1) hands.push(trackedHand);
      else if ((hands[duplicateIndex]?.confidence ?? 0) < trackedHand.confidence) {
        hands[duplicateIndex] = trackedHand;
      }
    }

    const left = hands.find((hand) => hand.side === 'left') ?? null;
    const right = hands.find((hand) => hand.side === 'right') ?? null;
    this.onFrame({ hands, left, right });
  }

  public stop(): void {
    this.running = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
  }

  private getErrorStatus(error: unknown): HandTrackerStatus {
    if (!(error instanceof DOMException)) return 'error';
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'permission-denied';
    }
    if (
      error.name === 'NotFoundError' ||
      error.name === 'NotReadableError' ||
      error.name === 'OverconstrainedError'
    ) {
      return 'camera-unavailable';
    }
    return 'error';
  }
}
