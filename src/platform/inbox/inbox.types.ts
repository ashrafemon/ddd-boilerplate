/**
 * Inbox types — identity, requests, results, reservation.
 */

/** Logical identity for an inbox message. */
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
  messageVersion?: number;

  payloadHash?: string;
  payload: unknown;

  occurredAt?: Date;

  correlationId?: string;
  causationId?: string;
}

/** Opaque proof of ownership — required for complete/fail. */
export interface InboxReservation {
  id: string;
  claimToken: string;
  version: number;
}

/** Result of a receive attempt. */
export type InboxReceiveResult =
  | {
      status: 'ACQUIRED';
      reservation: InboxReservation;
    }
  | {
      status: 'PROCESSED';
    }
  | {
      status: 'IN_PROGRESS';
    }
  | {
      status: 'FAILED';
    }
  | {
      status: 'SUSPENDED';
    }
  | {
      status: 'MESSAGE_REUSED';
    };

/** Request to mark an inbox message as completed. */
export interface InboxCompleteRequest {
  reservation: InboxReservation;
}

/** Request to mark an inbox message as failed. */
export interface InboxFailRequest {
  reservation: InboxReservation;

  errorCode?: string;
  errorMessage?: string;

  nextAttemptAt?: Date;
}

/** Inbox message record. */
export interface InboxMessage {
  id: string;
  tenantId: string | null;
  organizationId: string | null;
  consumer: string;
  messageId: string;
  messageType: string;
  messageVersion: number;
  payloadHash: string | null;
  payload: unknown;
  occurredAt: Date | null;
  receivedAt: Date;
  status: string;
  attempts: number;
  claimToken: string;
  claimedAt: Date | null;
  processedAt: Date | null;
  nextAttemptAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  lastError: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/** Options for claiming retryable messages. */
export interface ClaimInboxOptions {
  batchSize: number;
  maxAttempts: number;
}

/** Inbox configuration. */
export interface IInboxConfig {
  claimLeaseMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  reconciliationIntervalMs: number;
  batchSize: number;
}
