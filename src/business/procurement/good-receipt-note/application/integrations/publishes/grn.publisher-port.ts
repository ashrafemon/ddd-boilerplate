import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';

export abstract class GrnPublisherPort {
  abstract send(event: OutboxEvent, grnId: string): Promise<void>;
}
