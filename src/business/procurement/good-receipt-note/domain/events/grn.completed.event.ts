import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../value-objects/grn.vos';

export class GrnCompleted extends DomainEvent {
  constructor(public readonly grnId: GrnId) {
    super();
  }
}
