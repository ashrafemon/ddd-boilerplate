import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

/**
 * Generic outbox publisher port — the single reusable outbox contract.
 * Each business module extends this with its own named port (e.g.
 * `PurchaseOrderPublisherPort`, `InventoryPublisherPort`), but all delegate
 * to the same `SharedOutboxAdapter` implementation.
 */
export abstract class GenericOutboxPublisherPort {
  abstract send(event: OutboxEvent, aggregateId: string): Promise<void>;
}
