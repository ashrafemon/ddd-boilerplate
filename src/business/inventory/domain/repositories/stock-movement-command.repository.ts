import { StockBalance } from '../aggregates/stock-movement.aggregate';
import { StockMovement } from '../aggregates/stock-movement.aggregate';

export abstract class StockMovementCommandRepository {
  abstract findById(id: string): Promise<StockMovement | null>;
  abstract findByGrnLineId(grnLineId: string): Promise<StockMovement | null>;
  abstract save(movement: StockMovement): Promise<StockMovement>;
}

export abstract class StockBalanceRepository {
  abstract findByProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<StockBalance | null>;
  abstract save(balance: StockBalance): Promise<StockBalance>;
}
