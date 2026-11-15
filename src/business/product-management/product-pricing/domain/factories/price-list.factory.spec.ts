import { PriceListFactory } from './price-list.factory';
import { PriceListStatus } from '../types/price-list.enum';

describe('PriceListFactory', () => {
  it('creates a DRAFT list with normalized fields', () => {
    const list = PriceListFactory.create({
      name: '  List  ',
      code: '  list-1  ',
      currency: 'USD',
      effectiveFrom: new Date('2026-01-01'),
    });

    expect(list.name).toBe('List');
    expect(list.code).toBe('LIST-1');
    expect(list.status).toBe(PriceListStatus.DRAFT);
    expect(list.lineItems).toHaveLength(0);
  });

  it('raises PriceListCreated', () => {
    const list = PriceListFactory.create({
      name: 'List',
      code: 'L1',
      currency: 'USD',
      effectiveFrom: new Date(),
    });
    expect(list.pullEvents()).toHaveLength(1);
  });

  it('rejects a missing name', () => {
    expect(() =>
      PriceListFactory.create({ name: '', code: 'L1', currency: 'USD', effectiveFrom: new Date() }),
    ).toThrow('Price list name is required');
  });

  it('rejects a missing code', () => {
    expect(() =>
      PriceListFactory.create({ name: 'L', code: '', currency: 'USD', effectiveFrom: new Date() }),
    ).toThrow('Price list code is required');
  });

  it('rejects a missing currency', () => {
    expect(() =>
      PriceListFactory.create({ name: 'L', code: 'L1', currency: '', effectiveFrom: new Date() }),
    ).toThrow('Price list currency is required');
  });
});
