import { StockMovementType } from '../types/stock-movement.enum';

export class StockMovementInvariants {
  static enforceStockMovementQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw Object.assign(new Error('Stock movement quantity must be >= 1'), {
        statusCode: 422,
      });
    }
  }

  static enforceStockMovementType(movementType: StockMovementType): void {
    const valid =
      movementType === StockMovementType.GOODS_RECEIPT ||
      movementType === StockMovementType.GOODS_RECEIPT_REVERSAL;
    if (!valid) {
      throw Object.assign(new Error(`Invalid movement type: ${String(movementType)}`), {
        statusCode: 422,
      });
    }
  }

  static enforceStockMovementReversal(reversalOfId: string | null): void {
    if (!reversalOfId) {
      throw Object.assign(new Error('Reversal requires reversalOfId'), { statusCode: 422 });
    }
  }
}
