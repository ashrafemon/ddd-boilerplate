import { StockMovement } from '../aggregates/stock-movement.aggregate';
import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementProps } from '../types/stock-movement.types';
import { StockMovementType } from '../types/stock-movement.enum';

export class StockMovementFactory {
  static record(input: {
    grnLineId: string;
    productId: string;
    quantity: number;
    movementType: string;
    sourceDocumentId: string;
    sourceDocumentType: string;
    companyId?: string;
    tenantId?: string | null;
    actorId?: string | null;
    effectiveDate?: Date | null;
  }): StockMovement {
    const now = input.effectiveDate ?? new Date();
    const movementType =
      input.movementType === 'GOODS_RECEIPT_REVERSAL'
        ? StockMovementType.GOODS_RECEIPT_REVERSAL
        : StockMovementType.GOODS_RECEIPT;

    return StockMovement.record({
      grnLineId: input.grnLineId,
      productId: input.productId,
      quantity: input.quantity,
      movementType,
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentType: input.sourceDocumentType,
      companyId: input.companyId ?? '',
      tenantId: input.tenantId ?? null,
      actorId: input.actorId ?? null,
      effectiveDate: now,
      reversalOfId:
        movementType === StockMovementType.GOODS_RECEIPT_REVERSAL ? input.sourceDocumentId : null,
    });
  }

  static reconstitute(props: StockMovementProps, version: number): StockMovement {
    return StockMovement.instantiate(
      StockMovementId.fromString(props.id.toString()),
      props,
      version,
    );
  }
}
