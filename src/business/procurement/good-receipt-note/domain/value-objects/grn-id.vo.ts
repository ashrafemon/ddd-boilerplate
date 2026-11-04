import { randomUUID } from 'crypto';
export class GrnId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): GrnId {
    return new GrnId(value);
  }

  /**
   * A GRN id is a UUID: `good_receipt_notes.id` and `grn_lines.grnId` are
   * `@db.Uuid` columns, so a non-UUID string (e.g. `GRN-1758...-a1b2c3`) is
   * rejected by Postgres with `invalid input syntax for type uuid`.
   */
  static generate(): GrnId {
    return new GrnId(randomUUID());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: GrnId): boolean {
    return !!other && this.value === other.value;
  }
}
