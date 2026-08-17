import {
  HAND_LOST_TIMEOUT_MS,
  NEUTRAL_INTERACTION,
  SOLAR_WORLD,
} from '../config/constants';
import type { HandTrackingFrame } from '../hand/HandTracker';
import { ExponentialSmoother } from '../hand/smoothing';

export interface SmoothedHandState {
  readonly detected: boolean;
  readonly openness: number;
  readonly pinch: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface InteractionSnapshot {
  readonly right: SmoothedHandState;
  readonly left: SmoothedHandState;
  readonly handCount: number;
  readonly solarPresence: number;
  readonly zoom: number;
}

export class InteractionState {
  private rightTargetOpenness: number = NEUTRAL_INTERACTION.openness;
  private rightTargetX: number = NEUTRAL_INTERACTION.x;
  private rightTargetY: number = NEUTRAL_INTERACTION.y;
  private rightTargetZ: number = NEUTRAL_INTERACTION.z;
  private leftTargetOpenness: number = NEUTRAL_INTERACTION.openness;
  private leftTargetPinch = 0;
  private leftTargetX: number = NEUTRAL_INTERACTION.x;
  private leftTargetY: number = NEUTRAL_INTERACTION.y;
  private leftTargetZ: number = NEUTRAL_INTERACTION.z;
  private lastRightSeenAt = -Infinity;
  private lastLeftSeenAt = -Infinity;

  private readonly rightOpenness = new ExponentialSmoother(NEUTRAL_INTERACTION.openness, 0.105);
  private readonly rightX = new ExponentialSmoother(NEUTRAL_INTERACTION.x, 0.18);
  private readonly rightY = new ExponentialSmoother(NEUTRAL_INTERACTION.y, 0.2);
  private readonly rightZ = new ExponentialSmoother(NEUTRAL_INTERACTION.z, 0.24);
  private readonly leftOpenness = new ExponentialSmoother(NEUTRAL_INTERACTION.openness, 0.14);
  private readonly leftPinch = new ExponentialSmoother(0, SOLAR_WORLD.zoomHalfLife);
  private readonly leftX = new ExponentialSmoother(NEUTRAL_INTERACTION.x, 0.2);
  private readonly leftY = new ExponentialSmoother(NEUTRAL_INTERACTION.y, 0.22);
  private readonly leftZ = new ExponentialSmoother(NEUTRAL_INTERACTION.z, 0.24);
  private readonly solarPresence = new ExponentialSmoother(0, SOLAR_WORLD.revealHalfLife);

  public ingest(frame: HandTrackingFrame, timestampMs: number): void {
    if (frame.right) {
      this.lastRightSeenAt = timestampMs;
      this.rightTargetOpenness = frame.right.openness;
      this.rightTargetX = frame.right.handX;
      this.rightTargetY = frame.right.handY;
      this.rightTargetZ = frame.right.handZ;
    }

    if (frame.left) {
      this.lastLeftSeenAt = timestampMs;
      this.leftTargetOpenness = frame.left.openness;
      this.leftTargetPinch = frame.left.pinch;
      this.leftTargetX = frame.left.handX;
      this.leftTargetY = frame.left.handY;
      this.leftTargetZ = frame.left.handZ;
    }
  }

  public update(deltaSeconds: number, timestampMs: number): InteractionSnapshot {
    const rightDetected = timestampMs - this.lastRightSeenAt <= HAND_LOST_TIMEOUT_MS;
    const leftDetected = timestampMs - this.lastLeftSeenAt <= HAND_LOST_TIMEOUT_MS;

    if (!rightDetected) {
      this.rightTargetOpenness = NEUTRAL_INTERACTION.openness;
      this.rightTargetX = NEUTRAL_INTERACTION.x;
      this.rightTargetY = NEUTRAL_INTERACTION.y;
      this.rightTargetZ = NEUTRAL_INTERACTION.z;
    }

    if (!leftDetected) {
      this.leftTargetOpenness = NEUTRAL_INTERACTION.openness;
      this.leftTargetPinch = 0;
      this.leftTargetX = NEUTRAL_INTERACTION.x;
      this.leftTargetY = NEUTRAL_INTERACTION.y;
      this.leftTargetZ = NEUTRAL_INTERACTION.z;
    }

    const rightHalfLife = rightDetected ? 0.105 : 0.62;
    const rightPositionHalfLife = rightDetected ? 0.18 : 0.7;
    const leftPositionHalfLife = leftDetected ? 0.2 : 0.68;
    const smoothedPinch = this.leftPinch.update(
      leftDetected ? this.leftTargetPinch : 0,
      deltaSeconds,
      leftDetected ? SOLAR_WORLD.zoomHalfLife : 0.38,
    );

    return {
      right: {
        detected: rightDetected,
        openness: this.rightOpenness.update(this.rightTargetOpenness, deltaSeconds, rightHalfLife),
        pinch: 0,
        x: this.rightX.update(this.rightTargetX, deltaSeconds, rightPositionHalfLife),
        y: this.rightY.update(this.rightTargetY, deltaSeconds, rightPositionHalfLife),
        z: this.rightZ.update(this.rightTargetZ, deltaSeconds, rightPositionHalfLife),
      },
      left: {
        detected: leftDetected,
        openness: this.leftOpenness.update(this.leftTargetOpenness, deltaSeconds, leftDetected ? 0.14 : 0.55),
        pinch: smoothedPinch,
        x: this.leftX.update(this.leftTargetX, deltaSeconds, leftPositionHalfLife),
        y: this.leftY.update(this.leftTargetY, deltaSeconds, leftPositionHalfLife),
        z: this.leftZ.update(this.leftTargetZ, deltaSeconds, leftPositionHalfLife),
      },
      handCount: Number(rightDetected) + Number(leftDetected),
      solarPresence: this.solarPresence.update(leftDetected ? 1 : 0, deltaSeconds),
      zoom: smoothedPinch * SOLAR_WORLD.maximumZoom,
    };
  }
}
