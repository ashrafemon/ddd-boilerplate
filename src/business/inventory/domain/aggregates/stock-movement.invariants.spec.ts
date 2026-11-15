import { StockMovementInvariants } from './stock-movement.invariants';
import { StockMovementType } from '../types/stock-movement.enum';

describe('StockMovementInvariants', () => {
  describe('enforceStockMovementQuantity', () => {
    it('accepts a quantity of 1', () => {
      expect(() => StockMovementInvariants.enforceStockMovementQuantity(1)).not.toThrow();
    });

    it('rejects zero', () => {
      expect(() => StockMovementInvariants.enforceStockMovementQuantity(0)).toThrow(
        'Stock movement quantity must be >= 1',
      );
    });

    it('rejects a negative quantity', () => {
      expect(() => StockMovementInvariants.enforceStockMovementQuantity(-1)).toThrow(
        'Stock movement quantity must be >= 1',
      );
    });

    it('rejects a non-finite quantity', () => {
      expect(() => StockMovementInvariants.enforceStockMovementQuantity(Number.NaN)).toThrow(
        'Stock movement quantity must be >= 1',
      );
    });
  });

  describe('enforceStockMovementType', () => {
    it('accepts GOODS_RECEIPT', () => {
      expect(() =>
        StockMovementInvariants.enforceStockMovementType(StockMovementType.GOODS_RECEIPT),
      ).not.toThrow();
    });

    it('accepts GOODS_RECEIPT_REVERSAL', () => {
      expect(() =>
        StockMovementInvariants.enforceStockMovementType(StockMovementType.GOODS_RECEIPT_REVERSAL),
      ).not.toThrow();
    });

    it('rejects other types', () => {
      expect(() => StockMovementInvariants.enforceStockMovementType('SALE' as never)).toThrow(
        'Invalid movement type',
      );
    });
  });

  describe('enforceStockMovementReversal', () => {
    it('requires a reversalOfId', () => {
      expect(() => StockMovementInvariants.enforceStockMovementReversal(null)).toThrow(
        'Reversal requires reversalOfId',
      );
    });

    it('accepts a reversalOfId', () => {
      expect(() => StockMovementInvariants.enforceStockMovementReversal('sm-1')).not.toThrow();
    });
  });
});
