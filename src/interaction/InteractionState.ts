import { HAND_LOST_TIMEOUT_MS, NEUTRAL_INTERACTION } from '../config/constants';
import type { HandTrackingFrame } from '../hand/HandTracker';
import { ExponentialSmoother } from '../hand/smoothing';

export interface InteractionSnapshot {
  readonly handDetected: boolean;
  readonly openness: number;
  readonly handX: number;
  readonly handY: number;
  readonly handZ: number;
}

export class InteractionState {
  private targetOpenness: number = NEUTRAL_INTERACTION.openness;
  private targetX: number = NEUTRAL_INTERACTION.x;
  private targetY: number = NEUTRAL_INTERACTION.y;
  private targetZ: number = NEUTRAL_INTERACTION.z;
  private lastSeenAt = -Infinity;
  private detected = false;

  private readonly openness = new ExponentialSmoother(NEUTRAL_INTERACTION.openness, 0.105);
  private readonly x = new ExponentialSmoother(NEUTRAL_INTERACTION.x, 0.18);
  private readonly y = new ExponentialSmoother(NEUTRAL_INTERACTION.y, 0.2);
  private readonly z = new ExponentialSmoother(NEUTRAL_INTERACTION.z, 0.24);

  public ingest(frame: HandTrackingFrame, timestampMs: number): void {
    this.detected = frame.detected;
    if (!frame.detected) return;

    this.lastSeenAt = timestampMs;
    this.targetOpenness = frame.openness;
    this.targetX = frame.handX;
    this.targetY = frame.handY;
    this.targetZ = frame.handZ;
  }

  public update(deltaSeconds: number, timestampMs: number): InteractionSnapshot {
    const hasRecentHand = this.detected && timestampMs - this.lastSeenAt <= HAND_LOST_TIMEOUT_MS;

    if (!hasRecentHand) {
      this.targetOpenness = NEUTRAL_INTERACTION.openness;
      this.targetX = NEUTRAL_INTERACTION.x;
      this.targetY = NEUTRAL_INTERACTION.y;
      this.targetZ = NEUTRAL_INTERACTION.z;
    }

    const opennessHalfLife = hasRecentHand ? 0.105 : 0.62;
    const positionHalfLife = hasRecentHand ? 0.18 : 0.7;

    return {
      handDetected: hasRecentHand,
      openness: this.openness.update(this.targetOpenness, deltaSeconds, opennessHalfLife),
      handX: this.x.update(this.targetX, deltaSeconds, positionHalfLife),
      handY: this.y.update(this.targetY, deltaSeconds, positionHalfLife),
      handZ: this.z.update(this.targetZ, deltaSeconds, positionHalfLife),
    };
  }
}
