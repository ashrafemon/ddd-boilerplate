import { OutboxEvent } from '@platform/outbox/outbox.types';

export abstract class PurchaseOrderPublisherPort {
  abstract send(event: OutboxEvent, purchaseOrderId: string): Promise<void>;
}
