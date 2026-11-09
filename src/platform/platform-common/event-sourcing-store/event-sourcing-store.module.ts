import { Module } from '@nestjs/common';

/**
 * Event Sourcing Store — DEFERRED.
 *
 * Domain events (see `shared-business/domain/bases/event.base.ts`) are NOT
 * event sourcing. The current transactional DB + outbox/inbox is sufficient.
 * This module is a placeholder for future event-stream persistence only if
 * a specific requirement for event replay arises.
 */
@Module({})
export class EventSourcingStoreModule {}
