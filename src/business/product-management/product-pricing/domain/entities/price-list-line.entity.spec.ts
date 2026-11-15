import { PriceListLine } from './price-list-line.entity';

const base = {
  priceListId: 'pl-1',
  productId: 'p1',
  price: 100,
  minQuantity: 1,
};

describe('PriceListLine', () => {
  it('creates a line with a generated id and null maxQuantity by default', () => {
    const line = PriceListLine.create(base);
    expect(line.id).toBeTruthy();
    expect(line.price).toBe(100);
    expect(line.minQuantity).toBe(1);
    expect(line.maxQuantity).toBeNull();
  });

  it('accepts an explicit maxQuantity', () => {
    const line = PriceListLine.create({ ...base, maxQuantity: 10 });
    expect(line.maxQuantity).toBe(10);
  });

  it('updates the price', () => {
    const line = PriceListLine.create(base);
    line.updatePrice(200);
    expect(line.price).toBe(200);
  });

  it('updates the quantity range', () => {
    const line = PriceListLine.create(base);
    line.updateQuantities(5, 20);
    expect(line.minQuantity).toBe(5);
    expect(line.maxQuantity).toBe(20);
  });
});
