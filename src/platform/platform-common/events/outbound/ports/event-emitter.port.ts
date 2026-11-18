import type { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';

/** The `message` a listener receives — the canonical transport envelope. */
export type MessageEnvelope = OutboxEnvelope;

/**
 * Outbound port: the in-process emitter (EventEmitter2).
 *
 * Best-effort by contract: dispatch to local `@OnEvent` listeners happens after
 * the broker already has the message, so a throwing listener is logged by the
 * adapter and never propagated to the caller (the outbox dispatcher).
 */
export abstract class EventEmitterPort {
  abstract emit(eventType: string, envelope: MessageEnvelope): void;
}
