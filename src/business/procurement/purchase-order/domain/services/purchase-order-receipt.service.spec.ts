import { PurchaseOrderReceiptService } from './purchase-order-receipt.service';

describe('PurchaseOrderReceiptService', () => {
  describe('deriveStatus', () => {
    it('returns NOT_RECEIVED for an empty list', () => {
      expect(PurchaseOrderReceiptService.deriveStatus([])).toBe('NOT_RECEIVED');
    });

    it('returns NOT_RECEIVED when nothing received', () => {
      expect(
        PurchaseOrderReceiptService.deriveStatus([{ quantity: 10, receivedQuantity: 0 }]),
      ).toBe('NOT_RECEIVED');
    });

    it('returns PARTIALLY_RECEIVED when some lines have receipts', () => {
      expect(
        PurchaseOrderReceiptService.deriveStatus([
          { quantity: 10, receivedQuantity: 4 },
          { quantity: 5, receivedQuantity: 0 },
        ]),
      ).toBe('PARTIALLY_RECEIVED');
    });

    it('returns FULLY_RECEIVED when every line is fully received', () => {
      expect(
        PurchaseOrderReceiptService.deriveStatus([
          { quantity: 10, receivedQuantity: 10 },
          { quantity: 5, receivedQuantity: 5 },
        ]),
      ).toBe('FULLY_RECEIVED');
    });

    it('supports orderedQuantity as the ordered field', () => {
      expect(
        PurchaseOrderReceiptService.deriveStatus([{ orderedQuantity: 10, receivedQuantity: 10 }]),
      ).toBe('FULLY_RECEIVED');
    });

    it('treats over-receipt as fully received', () => {
      expect(
        PurchaseOrderReceiptService.deriveStatus([{ quantity: 10, receivedQuantity: 12 }]),
      ).toBe('FULLY_RECEIVED');
    });
  });
});
