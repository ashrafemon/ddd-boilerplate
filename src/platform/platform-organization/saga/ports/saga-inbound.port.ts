import { OutboxEnvelope } from '@platform/outbox/outbox.types';

/**
 * SagaInboundPort — the seam a broker consumer / business listener uses to feed
 * the saga. The saga owns no broker adapter of its own; whoever delivers the
 * canonical envelope calls `accept`, and the router decides what happens.
 */
export abstract class SagaInboundPort {
  abstract accept(envelope: OutboxEnvelope): Promise<void>;
}
