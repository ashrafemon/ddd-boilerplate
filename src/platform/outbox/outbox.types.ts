/**
 * Outbox types — status enum, request/response shapes, repository options.
 */

/** Delivery lifecycle status for an outbox message. */
export enum OutboxStatus {
  PENDING = 'PENDING',
  /** CLAIMED maps to PERSISTED PUBLISHING in the DB schema for backward compat. */
  CLAIMED = 'CLAIMED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

/** Append a single event to the outbox. */
export interface AppendOutboxEventRequest {
  tenantId?: string;
  organizationId?: string;

  eventType: string;
  eventVersion?: number;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;

  occurredAt?: Date;

  correlationId?: string;
  causationId?: string;

  headers?: Record<string, string>;
}

/** Canonical outbox message record — persisted shape returned by append. */
export interface OutboxMessage {
  id: string;
  eventId: string;

  tenantId: string | null;
  organizationId: string | null;

  eventType: string;
  eventVersion: number;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;
  headers: Record<string, string> | null;

  occurredAt: Date;
  createdAt: Date;

  status: OutboxStatus;

  availableAt: Date;
  attempts: number;

  claimedAt: Date | null;
  claimToken: string | null;

  publishedAt: Date | null;
  lastError: string | null;

  correlationId: string | null;
  causationId: string | null;

  version: number;
}

/** Options for claiming a batch of messages for dispatch. */
export interface ClaimOutboxOptions {
  batchSize: number;
  maxAttempts: number;
}

/** Internal record shape used by the repository claim query. */
export interface OutboxClaimedRecord {
  id: string;
  eventId: string;

  tenantId: string | null;
  organizationId: string | null;

  eventType: string;
  eventVersion: number;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;
  headers: Record<string, string> | null;

  occurredAt: Date;

  status: string;
  attempts: number;
  claimToken: string;
  claimedAt: Date;

  correlationId: string | null;
  causationId: string | null;
}
