import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEBUG_HAND_TRACKING } from '../config/constants';
import type { HandTrackingFrame, TrackedHand } from '../hand/HandTracker';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;

export class CameraPreview {
  private readonly root: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly emptyState: HTMLElement;
  private readonly cameraState: HTMLElement;
  private readonly handState: HTMLElement;
  private readonly rightReadout: HTMLElement;
  private readonly leftReadout: HTMLElement;

  public constructor() {
    this.root = this.getElement<HTMLElement>('camera-preview');
    this.video = this.getElement<HTMLVideoElement>('camera-video');
    this.canvas = this.getElement<HTMLCanvasElement>('hand-overlay');
    this.context = this.canvas.getContext('2d');
    this.emptyState = this.getElement<HTMLElement>('camera-empty');
    this.cameraState = this.getElement<HTMLElement>('camera-state');
    this.handState = this.getElement<HTMLElement>('hand-state');
    this.rightReadout = this.getElement<HTMLElement>('right-readout');
    this.leftReadout = this.getElement<HTMLElement>('left-readout');
    this.canvas.hidden = !DEBUG_HAND_TRACKING;
  }

  public get videoElement(): HTMLVideoElement {
    return this.video;
  }

  public setActive(active: boolean): void {
    this.root.classList.toggle('is-active', active);
    this.emptyState.hidden = active;
    this.cameraState.textContent = active ? 'LIVE' : 'OFFLINE';
  }

  public update(frame: HandTrackingFrame): void {
    const detectedCount = frame.hands.length;
    this.handState.textContent = detectedCount === 2
      ? 'DUAL LOCK'
      : detectedCount === 1
        ? `${frame.right ? 'RIGHT' : 'LEFT'} LOCK`
        : 'SEARCHING';
    this.handState.classList.toggle('is-detected', detectedCount > 0);
    this.rightReadout.textContent = frame.right
      ? `R ${Math.round(frame.right.openness * 100).toString().padStart(2, '0')}%`
      : 'R --%';
    this.leftReadout.textContent = frame.left
      ? `L PINCH ${Math.round(frame.left.pinch * 100).toString().padStart(2, '0')}%`
      : 'L PINCH --%';

    if (!DEBUG_HAND_TRACKING) return;
    if (detectedCount > 0) this.drawHands(frame.hands);
    else this.clearLandmarks();
  }

  private drawHands(hands: readonly TrackedHand[]): void {
    if (!this.context || this.video.videoWidth === 0) return;

    if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    const { width, height } = this.canvas;
    this.context.clearRect(0, 0, width, height);
    this.context.lineWidth = Math.max(1.5, width / 500);

    for (const hand of hands) {
      this.drawLandmarks(
        hand.landmarks,
        hand.side === 'right' ? 'rgba(105, 242, 255, 0.78)' : 'rgba(184, 139, 255, 0.78)',
      );
    }
  }

  private drawLandmarks(landmarks: readonly NormalizedLandmark[], color: string): void {
    if (!this.context) return;
    const { width, height } = this.canvas;
    this.context.strokeStyle = color;
    this.context.fillStyle = color;
    this.context.beginPath();

    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end) continue;
      this.context.moveTo(start.x * width, start.y * height);
      this.context.lineTo(end.x * width, end.y * height);
    }
    this.context.stroke();

    for (const landmark of landmarks) {
      this.context.beginPath();
      this.context.arc(landmark.x * width, landmark.y * height, Math.max(2, width / 250), 0, Math.PI * 2);
      this.context.fill();
    }
  }

  private clearLandmarks(): void {
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required element #${id}`);
    return element as T;
  }
}
