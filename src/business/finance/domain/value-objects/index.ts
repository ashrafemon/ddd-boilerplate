import { randomUUID } from 'crypto';

export class JournalEntryId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): JournalEntryId {
    return new JournalEntryId(value);
  }

  static generate(): JournalEntryId {
    return new JournalEntryId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: JournalEntryId): boolean {
    return !!other && this.value === other.value;
  }
}

export class AccountingEntryId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): AccountingEntryId {
    return new AccountingEntryId(value);
  }

  static generate(): AccountingEntryId {
    return new AccountingEntryId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: AccountingEntryId): boolean {
    return !!other && this.value === other.value;
  }
}

export class VendorBillId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): VendorBillId {
    return new VendorBillId(value);
  }

  static generate(): VendorBillId {
    return new VendorBillId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: VendorBillId): boolean {
    return !!other && this.value === other.value;
  }
}

export class PaymentId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): PaymentId {
    return new PaymentId(value);
  }

  static generate(): PaymentId {
    return new PaymentId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: PaymentId): boolean {
    return !!other && this.value === other.value;
  }
}
