import { randomUUID } from 'crypto';

export class PurchaseOrderId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): PurchaseOrderId {
    return new PurchaseOrderId(value);
  }

  static generate(): PurchaseOrderId {
    return new PurchaseOrderId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: PurchaseOrderId): boolean {
    return !!other && this.value === other.value;
  }
}
