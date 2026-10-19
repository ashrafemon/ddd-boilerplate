import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../value-objects/grn.vos';

export class GrnReversed extends DomainEvent {
  constructor(
    public readonly grnId: GrnId,
    public readonly reversalOfId: string,
  ) {
    super();
  }
}
