import { Money } from './money';

describe('Money', () => {
  describe('construction', () => {
    it('creates zero for a currency', () => {
      expect(Money.ZERO('USD').minorUnits).toBe(0);
      expect(Money.ZERO('USD').currency).toBe('USD');
    });

    it('creates from minor units', () => {
      const money = Money.fromMinorUnits(1999, 'EUR');
      expect(money.minorUnits).toBe(1999);
      expect(money.currency).toBe('EUR');
    });

    it('rejects non-integer minor units', () => {
      expect(() => Money.fromMinorUnits(1.5, 'USD')).toThrow(
        'Money minor units must be an integer',
      );
    });

    it('rejects negative minor units', () => {
      expect(() => Money.fromMinorUnits(-1, 'USD')).toThrow('Money cannot be negative');
    });

    it('creates from a decimal number', () => {
      const money = Money.fromDecimal(19.99, 'USD');
      expect(money.minorUnits).toBe(1999);
    });

    it('creates from a decimal string', () => {
      const money = Money.fromDecimal('89.50', 'USD');
      expect(money.minorUnits).toBe(8950);
    });

    it('rejects an invalid decimal', () => {
      expect(() => Money.fromDecimal('not-a-number', 'USD')).toThrow('Invalid money value');
    });

    it('rounds fractional cents to the nearest minor unit', () => {
      expect(Money.fromDecimal(1.999, 'USD').minorUnits).toBe(200);
      expect(Money.fromDecimal(1.001, 'USD').minorUnits).toBe(100);
    });
  });

  describe('accessors', () => {
    it('exposes the decimal amount', () => {
      expect(Money.fromMinorUnits(1999, 'USD').amount).toBe(19.99);
    });

    it('exposes the currency code', () => {
      expect(Money.fromMinorUnits(100, 'GBP').currencyCode).toBe('GBP');
    });
  });

  describe('arithmetic', () => {
    it('adds same-currency values', () => {
      const sum = Money.fromMinorUnits(100, 'USD').add(Money.fromMinorUnits(250, 'USD'));
      expect(sum.minorUnits).toBe(350);
    });

    it('subtracts same-currency values', () => {
      const diff = Money.fromMinorUnits(250, 'USD').subtract(Money.fromMinorUnits(100, 'USD'));
      expect(diff.minorUnits).toBe(150);
    });

    it('rejects adding different currencies', () => {
      expect(() => Money.fromMinorUnits(100, 'USD').add(Money.fromMinorUnits(100, 'EUR'))).toThrow(
        'Currency mismatch',
      );
    });

    it('rejects subtracting different currencies', () => {
      expect(() =>
        Money.fromMinorUnits(100, 'USD').subtract(Money.fromMinorUnits(100, 'EUR')),
      ).toThrow('Currency mismatch');
    });

    it('multiplies by a factor and rounds', () => {
      expect(Money.fromMinorUnits(333, 'USD').multiply(3).minorUnits).toBe(999);
      expect(Money.fromMinorUnits(101, 'USD').multiply(1.5).minorUnits).toBe(152);
    });
  });

  describe('predicates and formatting', () => {
    it('detects zero', () => {
      expect(Money.ZERO('USD').isZero()).toBe(true);
      expect(Money.fromMinorUnits(1, 'USD').isZero()).toBe(false);
    });

    it('compares equality including currency', () => {
      expect(Money.fromMinorUnits(100, 'USD').equals(Money.fromMinorUnits(100, 'USD'))).toBe(true);
      expect(Money.fromMinorUnits(100, 'USD').equals(Money.fromMinorUnits(100, 'EUR'))).toBe(false);
      expect(Money.fromMinorUnits(100, 'USD').equals(undefined)).toBe(false);
    });

    it('formats to a two-decimal string', () => {
      expect(Money.fromMinorUnits(1999, 'USD').toDecimal()).toBe('19.99');
      expect(Money.ZERO('USD').toDecimal()).toBe('0.00');
    });
  });
});
