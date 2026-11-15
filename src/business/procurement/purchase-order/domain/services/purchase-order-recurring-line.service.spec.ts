import { PurchaseOrderRecurringLineService } from './purchase-order-recurring-line.service';

describe('PurchaseOrderRecurringLineService', () => {
  describe('validateAndMap', () => {
    it('maps valid lines', () => {
      const result = PurchaseOrderRecurringLineService.validateAndMap([
        { productId: 'prod-1', quantity: 5, unitPrice: 10 },
      ]);
      expect(result).toEqual([{ productId: 'prod-1', quantity: 5, unitPrice: 10 }]);
    });

    it('coerces numeric strings', () => {
      const result = PurchaseOrderRecurringLineService.validateAndMap([
        { productId: 'prod-1', quantity: '5', unitPrice: '10.5' },
      ]);
      expect(result[0].quantity).toBe(5);
      expect(result[0].unitPrice).toBe(10.5);
    });

    it('throws when the list is empty', () => {
      expect(() => PurchaseOrderRecurringLineService.validateAndMap([])).toThrow(
        'Purchase order must contain at least one line',
      );
    });

    it('throws when productId is missing', () => {
      expect(() =>
        PurchaseOrderRecurringLineService.validateAndMap([{ quantity: 5, unitPrice: 10 }]),
      ).toThrow('productId is required');
    });

    it('throws when quantity is not a number', () => {
      expect(() =>
        PurchaseOrderRecurringLineService.validateAndMap([
          { productId: 'p', quantity: 'abc', unitPrice: 10 },
        ]),
      ).toThrow('quantity must be a number');
    });

    it('throws when unitPrice is not a number', () => {
      expect(() =>
        PurchaseOrderRecurringLineService.validateAndMap([
          { productId: 'p', quantity: 1, unitPrice: 'abc' },
        ]),
      ).toThrow('unitPrice must be a number');
    });
  });
});
