import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { StockMovementId } from '../value-objects/stock-movement-id.vo';
import { StockMovementType } from '../types/stock-movement.enum';

export class StockMovementRecorded extends DomainEvent {
  constructor(
    public readonly movementId: StockMovementId,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly movementType: StockMovementType,
    public readonly sourceDocumentId: string,
    public readonly sourceDocumentType: string,
  ) {
    super();
  }
}
