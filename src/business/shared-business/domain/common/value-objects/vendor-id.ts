import { randomUUID } from 'crypto';

export class VendorId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): VendorId {
    return new VendorId(value);
  }

  static generate(): VendorId {
    return new VendorId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: VendorId): boolean {
    return !!other && this.value === other.value;
  }
}
