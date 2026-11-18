/**
 * Inbox types — identity, requests, reservation, result and the config shape.
 * Design `common/07-inbox`: the consumer-side counterpart of Outbox.
 */
import { createHash } from 'crypto';

/** Logical identity for an inbox message. NULLs normalise to '' at the repo edge. */
export interface InboxIdentity {
  tenantId: string;
  companyId: string;
  consumer: string;
  messageId: string;
}

/** Request to receive/claim an inbound message. */
export interface InboxReceiveRequest {
  tenantId?: string;
  companyId?: string;

  consumer: string;
  messageId: string;

  /** Contract event name (`inventory.grn.created`). Defaults to `messageType`. */
  messageType: string;
  eventVersion?: number;

  payload: unknown;
  headers?: Record<string, string>;

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
  /**
   * `true` parks the row as FAILED immediately instead of scheduling a retry —
   * for errors no redelivery can fix (contract mismatch, unparseable payload).
   */
  permanent?: boolean;
}

/** Inbox message record. */
export interface InboxMessage {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  messageId: string;
  messageType: string;
  eventVersion: number;
  payload: unknown;
  payloadHash: string | null;
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

/**
 * Stable content hash of a delivered payload (the `payload_hash` column).
 *
 * Sorted keys make the hash independent of JSON serialization order, so the same
 * logical payload always hashes the same; a redelivery that reuses a message id
 * with different content produces a different hash and is parked FAILED.
 */
export function hashInboxPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}
