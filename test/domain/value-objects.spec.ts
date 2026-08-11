import { Currency } from '../../src/shared-business/value-object/currency';
import { Money } from '../../src/shared-business/value-object/money';
import { Quantity } from '../../src/shared-business/value-object/quantity';
import { TaxRate } from '../../src/shared-business/value-object/tax-rate';
import { DomainException } from '../../src/shared-kernel/exceptions/domain.exception';

describe('Money', () => {
  it('stores amounts in integer cents', () => {
    const money = Money.from(12345, Currency.from('USD'));
    expect(money.getAmountCents()).toBe(12345);
    expect(money.getCurrency().getCode()).toBe('USD');
  });

  it('rejects non-integer cents', () => {
    expect(() => Money.from(10.5, Currency.from('USD'))).toThrow(DomainException);
  });

  it('adds only same-currency amounts', () => {
    const sum = Money.from(100, Currency.from('USD')).add(Money.from(250, Currency.from('USD')));
    expect(sum.getAmountCents()).toBe(350);
  });

  it('rejects cross-currency arithmetic', () => {
    expect(() =>
      Money.from(100, Currency.from('USD')).add(Money.from(100, Currency.from('EUR'))),
    ).toThrow(/different currencies/);
  });

  it('multiplies with rounding', () => {
    expect(Money.from(100, Currency.from('USD')).multiplyBy(2.5).getAmountCents()).toBe(250);
  });
});

describe('Quantity', () => {
  it('rejects zero and negative quantities', () => {
    expect(() => Quantity.from(0)).toThrow(DomainException);
    expect(() => Quantity.from(-1)).toThrow(DomainException);
  });

  it('supports arithmetic', () => {
    expect(Quantity.from(3).add(Quantity.from(2)).getValue()).toBe(5);
    expect(Quantity.from(5).subtract(Quantity.from(1)).getValue()).toBe(4);
  });
});

describe('TaxRate', () => {
  it('converts between basis points and percentage', () => {
    const rate = TaxRate.fromBasisPoints(2500);
    expect(rate.getPercentage()).toBe(25);
    expect(rate.getBasisPoints()).toBe(2500);
  });

  it('rejects rates above 100%', () => {
    expect(() => TaxRate.fromBasisPoints(10001)).toThrow(DomainException);
  });
});
