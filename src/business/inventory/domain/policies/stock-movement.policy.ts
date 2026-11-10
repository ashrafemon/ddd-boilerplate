import { StockMovementType } from '../types/stock-movement.enum';

export class StockMovementPolicy {
  static enforceStockMovementRecordAllowed(
    movementType: StockMovementType,
    quantity: number,
  ): void {
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw Object.assign(new Error('Stock movement quantity must be >= 1'), {
        statusCode: 422,
      });
    }
    if (
      movementType !== StockMovementType.GOODS_RECEIPT &&
      movementType !== StockMovementType.GOODS_RECEIPT_REVERSAL
    ) {
      throw Object.assign(new Error(`Invalid stock movement type: ${movementType}`), {
        statusCode: 422,
      });
    }
  }
}
