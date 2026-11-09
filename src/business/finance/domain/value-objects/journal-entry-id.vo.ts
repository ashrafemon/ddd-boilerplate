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
