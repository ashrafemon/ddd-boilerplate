import { randomUUID } from 'crypto';

export class ProductId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): ProductId {
    return new ProductId(value);
  }

  static generate(): ProductId {
    return new ProductId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: ProductId): boolean {
    return !!other && this.value === other.value;
  }
}
