import { StockMovementPolicy } from './stock-movement.policy';
import { StockMovementType } from '../types/stock-movement.enum';

describe('StockMovementPolicy', () => {
  it('allows recording a receipt', () => {
    expect(() =>
      StockMovementPolicy.enforceStockMovementRecordAllowed(StockMovementType.GOODS_RECEIPT, 5),
    ).not.toThrow();
  });

  it('allows recording a reversal', () => {
    expect(() =>
      StockMovementPolicy.enforceStockMovementRecordAllowed(
        StockMovementType.GOODS_RECEIPT_REVERSAL,
        5,
      ),
    ).not.toThrow();
  });

  it('rejects a quantity below 1', () => {
    expect(() =>
      StockMovementPolicy.enforceStockMovementRecordAllowed(StockMovementType.GOODS_RECEIPT, 0),
    ).toThrow('Stock movement quantity must be >= 1');
  });

  it('rejects an unsupported movement type', () => {
    expect(() => StockMovementPolicy.enforceStockMovementRecordAllowed('SALE' as never, 5)).toThrow(
      'Invalid stock movement type',
    );
  });
});
