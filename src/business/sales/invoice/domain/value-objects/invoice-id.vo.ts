import { randomUUID } from 'crypto';

export class InvoiceId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): InvoiceId {
    return new InvoiceId(value);
  }

  static generate(): InvoiceId {
    return new InvoiceId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: InvoiceId): boolean {
    return !!other && this.value === other.value;
  }
}
