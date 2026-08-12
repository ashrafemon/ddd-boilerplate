import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

/**
 * Records domain events into the transactional outbox. Implemented by the
 * platform outbox writer; called by application use cases inside a unit of
 * work so the write is atomic with the aggregate change.
 */
export interface OutboxWriterPort {
  append(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void>;
}

export const OUTBOX_WRITER = Symbol('OUTBOX_WRITER');
