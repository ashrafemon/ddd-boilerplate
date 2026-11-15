import { InvoiceRecurringLineService } from './invoice-recurring-line.service';

describe('InvoiceRecurringLineService', () => {
  describe('validateAndMap', () => {
    it('maps valid lines', () => {
      const result = InvoiceRecurringLineService.validateAndMap([
        { description: 'Widget', quantity: 2, unitPrice: 10 },
      ]);
      expect(result).toEqual([{ description: 'Widget', quantity: 2, unitPrice: 10 }]);
    });

    it('coerces numeric strings', () => {
      const result = InvoiceRecurringLineService.validateAndMap([
        { description: 'Widget', quantity: '2', unitPrice: '10.5' },
      ]);
      expect(result[0].quantity).toBe(2);
      expect(result[0].unitPrice).toBe(10.5);
    });

    it('throws when the list is empty', () => {
      expect(() => InvoiceRecurringLineService.validateAndMap([])).toThrow(
        'Recurring Invoice template must have at least one line',
      );
    });

    it('throws when description is missing', () => {
      expect(() =>
        InvoiceRecurringLineService.validateAndMap([{ quantity: 1, unitPrice: 1 }]),
      ).toThrow('description is required');
    });

    it('throws when quantity is not a number', () => {
      expect(() =>
        InvoiceRecurringLineService.validateAndMap([
          { description: 'W', quantity: 'abc', unitPrice: 1 },
        ]),
      ).toThrow('quantity must be a number');
    });

    it('throws when unitPrice is not a number', () => {
      expect(() =>
        InvoiceRecurringLineService.validateAndMap([
          { description: 'W', quantity: 1, unitPrice: 'abc' },
        ]),
      ).toThrow('unitPrice must be a number');
    });
  });
});
