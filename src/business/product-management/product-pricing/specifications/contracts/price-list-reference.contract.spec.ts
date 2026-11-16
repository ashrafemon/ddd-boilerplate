import {
  PriceListReference,
  PriceListLineReference,
} from '../../public/contracts/price-list-reference.contract';

describe('PriceListReference contract', () => {
  it('exposes the price list header fields', () => {
    const reference: PriceListReference = {
      id: 'pl-1',
      name: 'Retail',
      code: 'PL-1',
      currency: 'USD',
      status: 'DRAFT',
    };
    expect(reference).toMatchObject({ id: 'pl-1', code: 'PL-1', currency: 'USD' });
  });

  it('exposes nullable max quantity on price lines', () => {
    const line: PriceListLineReference = {
      priceListId: 'pl-1',
      productId: 'p-1',
      price: 10,
      minQuantity: 1,
      maxQuantity: null,
    };
    expect(line.maxQuantity).toBeNull();
    expect(line.minQuantity).toBe(1);
  });
});
