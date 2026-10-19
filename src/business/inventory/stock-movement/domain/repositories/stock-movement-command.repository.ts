import { StockMovement } from '../aggregates/stock-movement.aggregate';
import { MovementType } from '../types/stock-movement.types';

export abstract class StockMovementCommandRepository {
  abstract save(movement: StockMovement): Promise<StockMovement>;
  abstract findByGrnLineAndType(
    grnLineId: string,
    movementType: MovementType,
  ): Promise<StockMovement | null>;
}
