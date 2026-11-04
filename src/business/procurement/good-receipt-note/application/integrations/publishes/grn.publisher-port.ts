import { OutboxEvent } from '@platform/outbox/outbox.types';

export abstract class GrnPublisherPort {
  abstract send(event: OutboxEvent, grnId: string): Promise<void>;
}
