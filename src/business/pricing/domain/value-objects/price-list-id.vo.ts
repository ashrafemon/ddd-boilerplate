import { randomUUID } from 'crypto';

export class PriceListId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): PriceListId {
    return new PriceListId(value);
  }

  static generate(): PriceListId {
    return new PriceListId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: PriceListId): boolean {
    return !!other && this.value === other.value;
  }
}
