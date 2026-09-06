import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../value-objects/grn.vos';

export class GrnCreated extends DomainEvent {
  constructor(
    public readonly grnId: GrnId,
    public readonly grnNumber: string,
    public readonly purchaseOrderId: string,
  ) {
    super();
  }
}
