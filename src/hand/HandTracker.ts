import {
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import {
  HAND_MODEL_URL,
  MEDIAPIPE_WASM_URL,
  TRACKING_MAX_FPS,
} from '../config/constants';
import { averagePoint, clamp } from './handMath';
import { analyzeHandOpenness } from './handOpenness';

export type HandTrackerStatus =
  | 'idle'
  | 'loading-model'
  | 'requesting-camera'
  | 'ready'
  | 'permission-denied'
  | 'camera-unavailable'
  | 'error';

export interface HandTrackingFrame {
  detected: boolean;
  openness: number;
  handX: number;
  handY: number;
  handZ: number;
  landmarks: readonly NormalizedLandmark[] | null;
}

interface HandTrackerOptions {
  video: HTMLVideoElement;
  onStatusChange: (status: HandTrackerStatus) => void;
  onFrame: (frame: HandTrackingFrame) => void;
}

const NO_HAND_FRAME: HandTrackingFrame = {
  detected: false,
  openness: 0,
  handX: 0.5,
  handY: 0.5,
  handZ: 0,
  landmarks: null,
};

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
        numHands: 1,
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
    const landmarks = result.landmarks[0];
    if (!landmarks) {
      this.onFrame(NO_HAND_FRAME);
      return;
    }

    const analysis = analyzeHandOpenness(landmarks);
    const palmCenter = averagePoint(landmarks, [0, 5, 9, 13, 17]);

    this.onFrame({
      detected: true,
      openness: analysis.value,
      handX: clamp(1 - palmCenter.x),
      handY: clamp(palmCenter.y),
      handZ: clamp((analysis.palmScale - 0.07) / 0.2),
      landmarks,
    });
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
