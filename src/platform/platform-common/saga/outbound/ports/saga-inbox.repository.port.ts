import { SagaInboxRecord } from '../../types/saga.types';

/** Values needed to buffer one delivered event for an instance. */
export interface InsertInboxInput {
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string | null;
  headers?: Record<string, string> | null;
}

/**
 * Outbound port: the `saga_inbox` table — the saga's own deduplication ledger.
 *
 * Saga events are buffered per instance until the WAIT step consumes them; the
 * unique `(tenant, company, consumer, message_id)` makes a redelivery a no-op.
 */
export abstract class SagaInboxRepositoryPort {
  /** Dedupe on the identity; `null` when the event was already buffered. */
  abstract tryInsert(input: InsertInboxInput): Promise<SagaInboxRecord | null>;

  abstract markBuffered(
    id: string,
    correlationKey: string | null,
    instanceId: string | null,
  ): Promise<void>;

  abstract markConsumed(id: string): Promise<void>;

  abstract markIgnored(id: string, reason: string): Promise<void>;

  /** BUFFERED events for an instance, oldest first. */
  abstract listBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]>;

  abstract purgeOlderThan(days: number): Promise<number>;
}
