export class Quantity {
  private constructor(
    public readonly value: number,
    public readonly uomId: string,
  ) {}

  static of(value: number, uomId: string): Quantity {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Quantity must be a non-negative finite number');
    }
    return new Quantity(value, uomId);
  }

  add(other: Quantity): Quantity {
    if (other.uomId !== this.uomId) {
      throw new Error('UOM mismatch');
    }
    return new Quantity(this.value + other.value, this.uomId);
  }

  subtract(other: Quantity): Quantity {
    if (other.uomId !== this.uomId) {
      throw new Error('UOM mismatch');
    }
    const result = this.value - other.value;
    if (result < 0) {
      throw new Error('Quantity cannot be negative');
    }
    return new Quantity(result, this.uomId);
  }

  multiply(factor: number): Quantity {
    return new Quantity(this.value * factor, this.uomId);
  }

  isGreaterThan(other: Quantity): boolean {
    return this.value > other.value;
  }

  equals(other?: Quantity): boolean {
    return !!other && this.uomId === other.uomId && this.value === other.value;
  }
}
