import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEBUG_HAND_TRACKING } from '../config/constants';

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
  private readonly opennessReadout: HTMLElement;

  public constructor() {
    this.root = this.getElement<HTMLElement>('camera-preview');
    this.video = this.getElement<HTMLVideoElement>('camera-video');
    this.canvas = this.getElement<HTMLCanvasElement>('hand-overlay');
    this.context = this.canvas.getContext('2d');
    this.emptyState = this.getElement<HTMLElement>('camera-empty');
    this.cameraState = this.getElement<HTMLElement>('camera-state');
    this.handState = this.getElement<HTMLElement>('hand-state');
    this.opennessReadout = this.getElement<HTMLElement>('openness-readout');
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

  public update(detected: boolean, openness: number, landmarks: readonly NormalizedLandmark[] | null): void {
    this.handState.textContent = detected ? 'HAND LOCKED' : 'SEARCHING';
    this.handState.classList.toggle('is-detected', detected);
    this.opennessReadout.textContent = detected
      ? `OPENNESS — ${Math.round(openness * 100).toString().padStart(2, '0')}%`
      : 'OPENNESS — --%';

    if (!DEBUG_HAND_TRACKING) return;
    if (detected && landmarks) this.drawLandmarks(landmarks);
    else this.clearLandmarks();
  }

  private drawLandmarks(landmarks: readonly NormalizedLandmark[]): void {
    if (!this.context || this.video.videoWidth === 0) return;

    if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    const { width, height } = this.canvas;
    this.context.clearRect(0, 0, width, height);
    this.context.strokeStyle = 'rgba(105, 242, 255, 0.75)';
    this.context.lineWidth = Math.max(1.5, width / 500);
    this.context.beginPath();

    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end) continue;
      this.context.moveTo(start.x * width, start.y * height);
      this.context.lineTo(end.x * width, end.y * height);
    }
    this.context.stroke();

    this.context.fillStyle = '#d8fdff';
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
