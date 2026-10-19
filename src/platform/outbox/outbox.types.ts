/**
 * Outbox types — the single canonical envelope, the platform event contract,
 * the delivery status enum and the repository request/record shapes.
 *
 * `OutboxEnvelope` is THE canonical shape spoken by every transport in the
 * platform (Outbox dispatcher → MessageQueue adapters → brokers → business
 * consumers, and Outbox dispatcher → InProcessEventBus → @OnEvent listeners).
 * Because it lives here, the events and messaging modules speak the exact same
 * envelope with zero rehydration step.
 */
import { randomUUID } from 'crypto';

/** Broker a message is published to. `MessageQueuePort.publish` routes on it. */
export type BrokerTarget = 'rabbitmq' | 'kafka' | 'sqs';

/** The default broker target when the envelope does not name one. */
export const DEFAULT_BROKER_TARGET: BrokerTarget = 'rabbitmq';

/**
 * Canonical transport envelope. One stable shape on every broker and on the
 * in-process bus, so consumers are portable.
 */
export interface OutboxEnvelope {
  eventId: string;
  eventType: string;
  eventVersion?: number;

  tenantId?: string | null;
  companyId?: string | null;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;

  headers?: Record<string, string>;

  occurredAt: Date;

  correlationId?: string;
  causationId?: string;

  /** Target broker; defaults to `rabbitmq` when omitted. */
  broker?: BrokerTarget;
}

/**
 * Event Bus alias for the canonical envelope — the `message` a business
 * `@OnEvent` listener receives.
 */
export type MessageEnvelope = OutboxEnvelope;

/**
 * Platform-owned event contract. Business `DomainEvent`s satisfy it
 * structurally (same envelope fields), so the platform pipes business events
 * without importing anything from `@business/**`.
 */
export interface OutboxEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly headers?: Record<string, string>;
}

/**
 * Base class for the platform's OWN events (ImportJobCompleted,
 * RecurringOccurrenceRequested, BatchOperationJobCompleted, ...) so they ride
 * the same outbox pipeline as business events — no shared-business import.
 */
export abstract class OutboxEventBase implements OutboxEvent {
  readonly eventId: string = randomUUID();
  readonly occurredAt: Date = new Date();
  readonly version = 1;

  readonly correlationId?: string;
  readonly causationId?: string;
  readonly headers?: Record<string, string>;

  constructor(options?: {
    correlationId?: string;
    causationId?: string;
    headers?: Record<string, string>;
  }) {
    this.correlationId = options?.correlationId;
    this.causationId = options?.causationId;
    this.headers = options?.headers;
  }
}

/** Delivery lifecycle status for an outbox message. */
export enum OutboxStatus {
  /** Waiting to be claimed/published; also the in-flight state (claim stamps the lease). */
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  /** Terminal park state for poison messages; never auto-deleted. */
  DEAD_LETTER = 'DEAD_LETTER',
}

/** Append a single event to the outbox (inside the caller's transaction). */
export interface AppendOutboxEventRequest {
  tenantId?: string;
  companyId?: string;

  eventId: string;
  eventType: string;
  eventVersion?: number;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;

  occurredAt?: Date;

  correlationId?: string;
  causationId?: string;

  headers?: Record<string, string>;

  /** Broker the dispatcher should publish to; defaults to `rabbitmq`. */
  broker?: BrokerTarget;

  /** Earliest dispatch time; defaults to the append time. */
  nextRetryAt?: Date;
}

/** Canonical outbox message record — persisted shape returned by append. */
export interface OutboxMessage {
  id: string;
  eventId: string;

  tenantId: string | null;
  companyId: string | null;

  eventType: string;
  eventVersion: number;

  aggregateType: string;
  aggregateId: string;

  payload: Record<string, unknown>;
  headers: Record<string, string> | null;

  occurredAt: Date;
  createdAt: Date;

  status: OutboxStatus;

  nextRetryAt: Date | null;
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
  /** A claim older than this is considered abandoned and can be reclaimed. */
  claimLeaseMs: number;
}

/** Internal record shape used by the repository claim query. */
export interface OutboxClaimedRecord {
  id: string;
  eventId: string;

  tenantId: string | null;
  companyId: string | null;

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
