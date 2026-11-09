import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class PurchaseOrderPublisherPort {
  abstract send(event: OutboxEvent, purchaseOrderId: string): Promise<void>;
}
