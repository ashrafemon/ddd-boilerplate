import { OverReceiptPolicy } from './over-receipt.policy';

describe('OverReceiptPolicy', () => {
  describe('enforcePurchaseOrderOverReceipt', () => {
    it('passes when within ordered quantity', () => {
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 0, 8, 0)).not.toThrow();
    });

    it('passes at exact ordered quantity', () => {
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 0, 10, 0)).not.toThrow();
    });

    it('throws when over-receipt exceeds limit without tolerance', () => {
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 0, 11, 0)).toThrow(
        'Over-receipt',
      );
    });

    it('allows over-receipt within tolerance', () => {
      // ordered=10, tolerance=0.1 => limit=11, already=0, proposed=11 => ok
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 0, 11, 0.1)).not.toThrow();
    });

    it('throws when over-receipt exceeds tolerance', () => {
      // ordered=10, tolerance=0.1 => limit=11, already=5, proposed=7 => 12 > 11 => throw
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 5, 7, 0.1)).toThrow(
        'Over-receipt',
      );
    });

    it('passes with zero tolerance when exactly at limit with prior receipts', () => {
      // ordered=10, already=10, proposed=0, tolerance=0 => 10 <= 10 => ok
      expect(() => OverReceiptPolicy.enforcePurchaseOrderOverReceipt(10, 10, 0, 0)).not.toThrow();
    });
  });
});
