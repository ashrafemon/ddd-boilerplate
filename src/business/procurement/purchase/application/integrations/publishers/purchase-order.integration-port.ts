import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class PurchaseOrderIntegrationPort {
  abstract send(event: DomainEvent, purchaseOrderId: string): Promise<void>;
}