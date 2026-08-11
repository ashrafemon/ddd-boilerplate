export interface IdentifierProps {
  value: string;
}

/**
 * Base class for all typed identifiers in the system.
 *
 * Identifiers are value objects: immutable and equality-comparable. Subclasses
 * (VendorId, ProductId, PurchaseOrderId, ...) provide nominal typing so that a
 * VendorId cannot accidentally be passed where a ProductId is expected.
 */
export abstract class Identifier {
  private readonly _value: string;

  protected constructor(value: string) {
    if (value === undefined || value === null || value.trim().length === 0) {
      throw new Error(`[${this.constructor.name}] identifier value must be a non-empty string`);
    }
    this._value = value;
  }

  public getValue(): string {
    return this._value;
  }

  public toString(): string {
    return this._value;
  }

  public equals(other: Identifier | null | undefined): boolean {
    return other != null && other.constructor === this.constructor && other._value === this._value;
  }

  public toJSON(): string {
    return this._value;
  }
}
