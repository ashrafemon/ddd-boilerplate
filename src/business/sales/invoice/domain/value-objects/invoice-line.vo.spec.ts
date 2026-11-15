import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { InvoiceLine } from './invoice-line.vo';

describe('InvoiceLine', () => {
  it('creates a line and trims the description', () => {
    const line = InvoiceLine.create('  Widget  ', 2, Money.fromMinorUnits(500, 'USD'));
    expect(line.description).toBe('Widget');
    expect(line.quantity).toBe(2);
    expect(line.unitPrice.minorUnits).toBe(500);
  });

  it('computes the line total', () => {
    const line = InvoiceLine.create('Widget', 3, Money.fromMinorUnits(500, 'USD'));
    expect(line.total().minorUnits).toBe(1500);
  });

  it('compares equal lines', () => {
    const a = InvoiceLine.create('W', 1, Money.fromMinorUnits(100, 'USD'));
    const b = InvoiceLine.create('W', 1, Money.fromMinorUnits(100, 'USD'));
    expect(a.equals(b)).toBe(true);
  });
});
