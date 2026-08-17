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
      throw Object.assign(new Error('Money minor units must be an integer'), { statusCode: 422 });
    }
    if (minorUnits < 0) {
      throw Object.assign(new Error('Money cannot be negative'), { statusCode: 422 });
    }
    return new Money(minorUnits, currency);
  }

  static fromDecimal(decimal: string | number, currency = 'USD'): Money {
    const asNumber = typeof decimal === 'number' ? decimal : parseFloat(decimal);
    if (Number.isNaN(asNumber)) {
      throw Object.assign(new Error('Invalid money value'), { statusCode: 422 });
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
      throw Object.assign(
        new Error(`Currency mismatch: cannot combine ${this.currency} with ${other.currency}`),
        { statusCode: 422 },
      );
    }
  }
}
