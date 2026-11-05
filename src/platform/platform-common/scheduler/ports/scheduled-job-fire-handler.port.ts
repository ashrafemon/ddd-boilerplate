import { JsonObject } from '@shared-kernel/types/json-value.type';
export interface ScheduledJobPayload {
  /** null for EVENT-triggered dispatch — nothing to lock/release. */
  jobId: string | null;
  tenantId?: string;
  jobType: string;
  scope?: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload?: JsonObject | null;
  /** 1-based BullMQ attempt counter for the current execution (queue path only). */
  attempt?: number;
  /** Present only when dispatched via DomainEventDispatcher. */
  sourceEventId?: string;
  eventPayload?: JsonObject;
  /** Idempotency key for downstream dedupe on redelivery. */
  idempotencyKey?: string;
}

/**
 * Producer-facing fire contract. Registered externally via
 * ScheduledJobHandlerRegistry by the owning module — keyed by jobType.
 */
export interface ScheduledJobFireHandler {
  handle(payload: ScheduledJobPayload): Promise<void>;
}
