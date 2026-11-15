import { PriceListFactory } from '../factories/price-list.factory';
import { PriceListStatus } from '../types/price-list.enum';

function makeList() {
  return PriceListFactory.create({
    name: 'List',
    code: 'LIST-1',
    currency: 'USD',
    effectiveFrom: new Date('2026-01-01'),
  });
}

describe('PriceList aggregate', () => {
  it('exposes its header props', () => {
    const list = makeList();
    expect(list.name).toBe('List');
    expect(list.code).toBe('LIST-1');
    expect(list.currency).toBe('USD');
    expect(list.status).toBe(PriceListStatus.DRAFT);
  });

  describe('addLine', () => {
    it('adds a new line', () => {
      const list = makeList();
      list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });
      expect(list.lineItems).toHaveLength(1);
      expect(list.lineItems[0].price).toBe(100);
    });

    it('updates an existing line in place (no duplicate)', () => {
      const list = makeList();
      list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });
      list.addLine({ productId: 'p1', price: 150, minQuantity: 2 });
      expect(list.lineItems).toHaveLength(1);
      expect(list.lineItems[0].price).toBe(150);
      expect(list.lineItems[0].minQuantity).toBe(2);
    });

    it('rejects a negative price', () => {
      const list = makeList();
      expect(() => list.addLine({ productId: 'p1', price: -1, minQuantity: 1 })).toThrow(
        'Price list line price cannot be negative',
      );
    });

    it('rejects an invalid quantity range', () => {
      const list = makeList();
      expect(() =>
        list.addLine({ productId: 'p1', price: 1, minQuantity: 10, maxQuantity: 5 }),
      ).toThrow('Price list line maximum quantity must be >= minimum quantity');
    });
  });

  describe('removeLine', () => {
    it('removes an existing line', () => {
      const list = makeList();
      list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });
      list.removeLine('p1');
      expect(list.lineItems).toHaveLength(0);
    });

    it('throws when the line is missing', () => {
      const list = makeList();
      expect(() => list.removeLine('missing')).toThrow('not found in price list');
    });
  });

  describe('updateLine', () => {
    it('updates price and quantities', () => {
      const list = makeList();
      list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });
      list.updateLine({ productId: 'p1', price: 200, minQuantity: 5, maxQuantity: 20 });
      expect(list.lineItems[0].price).toBe(200);
      expect(list.lineItems[0].minQuantity).toBe(5);
      expect(list.lineItems[0].maxQuantity).toBe(20);
    });

    it('throws when the line is missing', () => {
      const list = makeList();
      expect(() => list.updateLine({ productId: 'missing', price: 1 })).toThrow(
        'not found in price list',
      );
    });

    it('rejects a negative price', () => {
      const list = makeList();
      list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });
      expect(() => list.updateLine({ productId: 'p1', price: -5 })).toThrow(
        'Price list line price cannot be negative',
      );
    });
  });

  describe('update', () => {
    it('updates the header fields', () => {
      const list = makeList();
      list.update({ name: '  New  ', code: 'new-code', currency: 'EUR' });
      expect(list.name).toBe('New');
      expect(list.code).toBe('NEW-CODE');
      expect(list.currency).toBe('EUR');
    });

    it('sets and clears effectiveTo', () => {
      const list = makeList();
      const to = new Date('2026-12-31');
      list.update({ effectiveTo: to });
      expect(list.effectiveTo).toEqual(to);
      list.update({ effectiveTo: null });
      expect(list.effectiveTo).toBeNull();
    });

    it('rejects an invalid code', () => {
      const list = makeList();
      expect(() => list.update({ code: '   ' })).toThrow('Price list code is required');
    });
  });

  describe('status transitions', () => {
    it('activates a draft list', () => {
      const list = makeList();
      list.activate();
      expect(list.status).toBe(PriceListStatus.ACTIVE);
    });

    it('archives an active list', () => {
      const list = makeList();
      list.activate();
      list.archive();
      expect(list.status).toBe(PriceListStatus.ARCHIVED);
    });

    it('cannot reactivate an archived list', () => {
      const list = makeList();
      list.activate();
      list.archive();
      expect(() => list.activate()).toThrow('Price list cannot be reactivated');
    });

    it('rejects an illegal transition', () => {
      const list = makeList();
      expect(() => list.archive()).not.toThrow();
      expect(() => list.activate()).toThrow('Price list cannot be reactivated');
    });
  });
});
