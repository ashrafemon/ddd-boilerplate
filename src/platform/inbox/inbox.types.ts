/**
 * Inbox types — identity, requests, reservation, result and the config shape.
 * Design 07: the consumer-side counterpart of Outbox.
 */

/** Logical identity for an inbox message. NULLs normalise to '' at the repo edge. */
export interface InboxIdentity {
  tenantId: string;
  organizationId: string;
  consumer: string;
  messageId: string;
}

/** Request to receive/claim an inbound message. */
export interface InboxReceiveRequest {
  tenantId?: string;
  organizationId?: string;

  consumer: string;
  messageId: string;

  messageType: string;
  payload: unknown;

  correlationId?: string;
  causationId?: string;
}

/** Opaque proof of ownership — required for complete/fail. */
export interface InboxReservation {
  id: string;
  claimToken: string;
}

/**
 * Result of a receive attempt.
 *
 * - `ACQUIRED`  first delivery (or the retry is due) — proceed.
 * - `DUPLICATE` already PROCESSED — return at once, do not touch the listener.
 * - `BUSY`      in flight, suspended, or not due for retry — return.
 */
export type InboxReceiveResult =
  | { status: 'ACQUIRED'; reservation: InboxReservation }
  | { status: 'DUPLICATE' }
  | { status: 'BUSY' };

/** Request to mark an inbox message as completed. */
export interface InboxCompleteRequest {
  reservation: InboxReservation;
}

/** Request to mark an inbox message as failed (kept pending for redelivery). */
export interface InboxFailRequest {
  reservation: InboxReservation;
  lastError?: string;
}

/** Inbox message record. */
export interface InboxMessage {
  id: string;
  tenantId: string;
  organizationId: string;
  consumer: string;
  messageId: string;
  messageType: string;
  payload: unknown;
  status: string;
  attempts: number;
  claimToken: string;
  claimedAt: Date | null;
  processedAt: Date | null;
  nextAttemptAt: Date | null;
  lastError: string | null;
  correlationId: string | null;
  causationId: string | null;
}

/** Inbox configuration. */
export interface IInboxConfig {
  /** Processing window before the reconciler may free a claim. */
  claimLeaseMs: number;
  /** Failures past this park the message as SUSPENDED. */
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  reconciliationIntervalMs: number;
  /** PROCESSED rows older than this are deleted; SUSPENDED never purge. */
  processedRetentionMs: number;
}
