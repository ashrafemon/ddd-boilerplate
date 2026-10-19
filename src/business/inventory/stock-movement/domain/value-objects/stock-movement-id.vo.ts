export class StockMovementId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): StockMovementId {
    return new StockMovementId(value);
  }

  static generate(): StockMovementId {
    return new StockMovementId(crypto.randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: StockMovementId): boolean {
    return !!other && this.value === other.value;
  }
}
