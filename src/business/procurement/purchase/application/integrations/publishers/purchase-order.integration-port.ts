import { DomainEvent } from '@business/shared-business';

export abstract class PurchaseOrderIntegrationPort {
  abstract send(event: DomainEvent, purchaseOrderId: string): Promise<void>;
}