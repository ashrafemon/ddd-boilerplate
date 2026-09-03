import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { GrnId } from '../../domain/value-objects';

export class GrnCreatedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly grnId: GrnId,
    public readonly grnNumber: string,
    public readonly purchaseOrderId: string,
  ) {
    super();
  }
}

export class GrnLineAddedIntegrationEvent extends DomainEvent {
  constructor(
    public readonly grnId: GrnId,
    public readonly productId: string,
  ) {
    super();
  }
}

export class GrnReceivedIntegrationEvent extends DomainEvent {
  constructor(public readonly grnId: GrnId) {
    super();
  }
}

export class GrnCompletedIntegrationEvent extends DomainEvent {
  constructor(public readonly grnId: GrnId) {
    super();
  }
}

export class GrnCancelledIntegrationEvent extends DomainEvent {
  constructor(public readonly grnId: GrnId) {
    super();
  }
}