import { InboxReceiveRequest, InboxMessage, ClaimInboxOptions } from '../inbox.types';

/**
 * Repository port for persistent inbox metadata in PostgreSQL.
 * Internal to the Inbox module — business modules consume only InboxPort.
 */
export abstract class InboxRepositoryPort {
  /** Find an existing inbox message by identity. */
  abstract findUnique(
    tenantId: string,
    organizationId: string,
    consumer: string,
    messageId: string,
  ): Promise<InboxMessage | null>;

  /** Insert a new IN_PROGRESS row with claim token. */
  abstract insert(
    request: InboxReceiveRequest,
    claimToken: string,
    payloadHash: string | null,
  ): Promise<{ id: string; version: number }>;

  /** CAS update: IN_PROGRESS → PROCESSED. Returns true if ownership valid. */
  abstract complete(id: string, claimToken: string, version: number): Promise<boolean>;

  /** CAS update: IN_PROGRESS → FAILED. Returns true if ownership valid. */
  abstract fail(
    id: string,
    claimToken: string,
    version: number,
    errorCode?: string,
    errorMessage?: string,
    nextAttemptAt?: Date,
  ): Promise<boolean>;

  /** Claim retryable FAILED messages for re-processing. */
  abstract claimRetryable(options: ClaimInboxOptions): Promise<InboxMessage[]>;

  /** Release expired claims (stuck IN_PROGRESS). */
  abstract releaseExpiredClaims(now: Date, claimLeaseMs: number): Promise<number>;
}
