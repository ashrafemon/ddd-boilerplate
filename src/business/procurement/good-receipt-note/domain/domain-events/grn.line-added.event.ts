import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../value-objects/grn.vos';

export class GrnLineAdded extends DomainEvent {
  constructor(
    public readonly grnId: GrnId,
    public readonly productId: string,
  ) {
    super();
  }
}
