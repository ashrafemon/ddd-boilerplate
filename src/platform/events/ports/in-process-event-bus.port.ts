import type { OutboxEnvelope } from '@platform/outbox/outbox.types';

/** The `message` a listener receives — the canonical transport envelope. */
export type MessageEnvelope = OutboxEnvelope;

/**
 * Public in-process event bus — best-effort local notification inside the
 * monolith. Durability belongs to Outbox; transport belongs to Message Queue.
 * This port is a thin emit wrapper: no retries, no storage, at-most-once.
 *
 * Subscribers use `@OnEvent('<EventType>')` on a business listener and read
 * `message.payload` — never a rehydrated event instance.
 */
export abstract class InProcessEventBus {
  abstract emit(envelope: MessageEnvelope): void;
}
