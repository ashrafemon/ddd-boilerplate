import { ValidationError } from './domain.error';

/**
 * Money value object backed by integer minor units (cents) to avoid binary
 * floating point drift. Persisted as Decimal via the repository mapper.
 */
export class Money {
  private constructor(
    public readonly minorUnits: number,
    public readonly currency: string,
  ) {}

  static ZERO(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  static fromMinorUnits(minorUnits: number, currency = 'USD'): Money {
    if (!Number.isInteger(minorUnits)) {
      throw new ValidationError('Money minor units must be an integer');
    }
    if (minorUnits < 0) {
      throw new ValidationError('Money cannot be negative');
    }
    return new Money(minorUnits, currency);
  }

  static fromDecimal(decimal: string | number, currency = 'USD'): Money {
    const asNumber = typeof decimal === 'number' ? decimal : parseFloat(decimal);
    if (Number.isNaN(asNumber)) {
      throw new ValidationError('Invalid money value');
    }
    return Money.fromMinorUnits(Math.round(asNumber * 100), currency);
  }

  get amount(): number {
    return this.minorUnits / 100;
  }

  get currencyCode(): string {
    return this.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.minorUnits * factor), this.currency);
  }

  isZero(): boolean {
    return this.minorUnits === 0;
  }

  equals(other?: Money): boolean {
    return !!other && this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  toDecimal(): string {
    return (this.minorUnits / 100).toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError(
        `Currency mismatch: cannot combine ${this.currency} with ${other.currency}`,
      );
    }
  }
}
