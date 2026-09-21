/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxReceiveRequest, InboxMessage, ClaimInboxOptions } from '../inbox.types';

/**
 * In-memory inbox repository for unit tests.
 */
export class InMemoryInboxRepository implements InboxRepositoryPort {
  private rows: InboxMessage[] = [];

  async findUnique(
    tenantId: string,
    organizationId: string,
    consumer: string,
    messageId: string,
  ): Promise<InboxMessage | null> {
    const tId = tenantId ?? '';
    const oId = organizationId ?? '';
    const row = this.rows.find(
      r =>
        r.tenantId === tId &&
        r.organizationId === oId &&
        r.consumer === consumer &&
        r.messageId === messageId,
    );
    return row ?? null;
  }

  async insert(
    request: InboxReceiveRequest,
    claimToken: string,
    payloadHash: string | null,
  ): Promise<{ id: string; version: number }> {
    const tenantId = request.tenantId ?? '';
    const organizationId = request.organizationId ?? '';
    const existing = this.rows.find(
      r =>
        r.tenantId === tenantId &&
        r.organizationId === organizationId &&
        r.consumer === request.consumer &&
        r.messageId === request.messageId,
    );
    if (existing) {
      throw new Error('Unique constraint violation');
    }
    const id = randomUUID();
    const now = new Date();
    const row: InboxMessage = {
      id,
      tenantId,
      organizationId,
      consumer: request.consumer,
      messageId: request.messageId,
      messageType: request.messageType,
      messageVersion: request.messageVersion ?? 1,
      payloadHash,
      payload: request.payload,
      occurredAt: request.occurredAt ?? null,
      receivedAt: now,
      status: 'IN_PROGRESS',
      attempts: 1,
      claimToken,
      claimedAt: now,
      processedAt: null,
      nextAttemptAt: null,
      errorCode: null,
      errorMessage: null,
      lastError: null,
      correlationId: request.correlationId ?? null,
      causationId: request.causationId ?? null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.rows.push(row);
    return { id, version: 1 };
  }

  async complete(id: string, claimToken: string, version: number): Promise<boolean> {
    const row = this.rows.find(
      r =>
        r.id === id &&
        r.claimToken === claimToken &&
        r.version === version &&
        r.status === 'IN_PROGRESS',
    );
    if (!row) return false;
    row.status = 'PROCESSED';
    row.processedAt = new Date();
    row.version += 1;
    return true;
  }

  async fail(
    id: string,
    claimToken: string,
    version: number,
    errorCode?: string,
    errorMessage?: string,
    nextAttemptAt?: Date,
  ): Promise<boolean> {
    const row = this.rows.find(
      r =>
        r.id === id &&
        r.claimToken === claimToken &&
        r.version === version &&
        r.status === 'IN_PROGRESS',
    );
    if (!row) return false;
    row.status = 'FAILED';
    row.errorCode = errorCode ?? null;
    row.errorMessage = errorMessage ?? null;
    row.lastError = errorMessage ?? null;
    row.nextAttemptAt = nextAttemptAt ?? null;
    row.version += 1;
    return true;
  }

  async claimRetryable(options: ClaimInboxOptions): Promise<InboxMessage[]> {
    const now = new Date();
    const candidates = this.rows
      .filter(r => r.status === 'FAILED' && r.nextAttemptAt && r.nextAttemptAt <= now)
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .slice(0, options.batchSize);

    for (const row of candidates) {
      row.status = 'IN_PROGRESS';
      row.claimToken = randomUUID();
      row.claimedAt = now;
      row.version += 1;
    }

    return candidates;
  }

  async releaseExpiredClaims(now: Date, claimLeaseMs: number): Promise<number> {
    const cutoff = new Date(now.getTime() - claimLeaseMs);
    let count = 0;
    for (const row of this.rows) {
      if (row.status === 'IN_PROGRESS' && row.claimedAt && row.claimedAt < cutoff) {
        row.status = 'FAILED';
        row.claimToken = '';
        row.claimedAt = null;
        row.version += 1;
        count++;
      }
    }
    return count;
  }

  /** Test helper: get all rows. */
  getAll(): readonly InboxMessage[] {
    return this.rows;
  }

  /** Test helper: clear all rows. */
  clear(): void {
    this.rows = [];
  }
}
