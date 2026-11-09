import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { StockMovementType } from '../types/stock-movement.enum';

invariantRegistry.register<{ quantity: number }>('stock-movement.quantity', {
  name: 'stock-movement-quantity-positive',
  check: ({ quantity }) => {
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw Object.assign(new Error('Stock movement quantity must be >= 1'), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ movementType: StockMovementType }>('stock-movement.type', {
  name: 'stock-movement-type-valid',
  check: ({ movementType }) => {
    const valid =
      movementType === StockMovementType.GOODS_RECEIPT ||
      movementType === StockMovementType.GOODS_RECEIPT_REVERSAL;
    if (!valid) {
      throw Object.assign(new Error(`Invalid movement type: ${String(movementType)}`), {
        statusCode: 422,
      });
    }
  },
});

invariantRegistry.register<{ reversalOfId: string | null }>('stock-movement.reversal', {
  name: 'stock-movement-reversal-requires-original',
  check: ({ reversalOfId }) => {
    if (!reversalOfId) {
      throw Object.assign(new Error('Reversal requires reversalOfId'), { statusCode: 422 });
    }
  },
});
