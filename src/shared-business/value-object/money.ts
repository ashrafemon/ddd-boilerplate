import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';
import { Currency } from './currency';

interface MoneyProps {
  amountCents: number;
  currency: Currency;
}

/**
 * Money value object.
 *
 * Amounts are stored as integer minor units (cents) to avoid floating point
 * rounding errors. Money is immutable; arithmetic returns new instances.
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(amountCents: number, currency: Currency) {
    if (!Number.isInteger(amountCents)) {
      throw new DomainException('Money amount must be an integer number of cents', 'INVALID_MONEY');
    }
    super({ amountCents, currency });
  }

  public static from(amountCents: number, currency: Currency): Money {
    return new Money(amountCents, currency);
  }

  public static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  public getAmountCents(): number {
    return this.props.amountCents;
  }

  public getCurrency(): Currency {
    return this.props.currency;
  }

  public isZero(): boolean {
    return this.props.amountCents === 0;
  }

  public isNegative(): boolean {
    return this.props.amountCents < 0;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.props.amountCents + other.props.amountCents, this.props.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.props.amountCents - other.props.amountCents, this.props.currency);
  }

  public multiplyBy(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new DomainException('Money multiplier must be a finite number', 'INVALID_MONEY');
    }
    return new Money(Math.round(this.props.amountCents * factor), this.props.currency);
  }

  public compareTo(other: Money): number {
    this.assertSameCurrency(other);
    return this.props.amountCents - other.props.amountCents;
  }

  public equalsAmount(other: Money): boolean {
    return this.equals(other);
  }

  private assertSameCurrency(other: Money): void {
    if (!this.props.currency.equals(other.props.currency)) {
      throw new DomainException(
        `Cannot operate on Money of different currencies: ${this.props.currency.getCode()} vs ${other.props.currency.getCode()}`,
        'CURRENCY_MISMATCH',
      );
    }
  }
}
