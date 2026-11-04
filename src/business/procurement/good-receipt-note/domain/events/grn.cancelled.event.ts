import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../value-objects/grn-id.vo';

export class GrnCancelled extends DomainEvent {
  constructor(public readonly grnId: GrnId) {
    super();
  }
}
