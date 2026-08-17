export class ExponentialSmoother {
  private currentValue: number;

  public constructor(initialValue: number, private readonly halfLifeSeconds: number) {
    this.currentValue = initialValue;
  }

  public update(target: number, deltaSeconds: number, halfLife = this.halfLifeSeconds): number {
    const safeDelta = Math.min(Math.max(deltaSeconds, 0), 0.1);
    const alpha = 1 - Math.exp((-Math.LN2 * safeDelta) / Math.max(halfLife, 0.001));
    this.currentValue += (target - this.currentValue) * alpha;
    return this.currentValue;
  }

  public reset(value: number): void {
    this.currentValue = value;
  }

  public get value(): number {
    return this.currentValue;
  }
}
