import { StockMovement } from '../aggregates/stock-movement.aggregate';
import { MovementType } from '../types/stock-movement.types';

export class StockMovementFactory {
  static create(input: {
    grnLineId: string;
    productId: string;
    quantity: number;
    movementType: MovementType;
    sourceDocumentId: string;
    sourceDocumentType: string;
    companyId: string;
    tenantId: string;
    actorId?: string;
    effectiveDate?: Date;
    reversalOfId?: string;
  }): StockMovement {
    return StockMovement.create({
      grnLineId: input.grnLineId,
      productId: input.productId,
      quantity: input.quantity,
      movementType: input.movementType,
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentType: input.sourceDocumentType,
      companyId: input.companyId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      effectiveDate: input.effectiveDate ?? new Date(),
      reversalOfId: input.reversalOfId,
    });
  }
}
