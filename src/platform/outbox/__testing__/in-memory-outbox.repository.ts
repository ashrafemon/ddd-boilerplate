/* eslint-disable @typescript-eslint/require-await -- in-memory test double: the port is async, the storage is a Map */
import { randomUUID } from 'crypto';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';
import {
  AppendOutboxEventRequest,
  ClaimOutboxOptions,
  OutboxClaimedRecord,
  OutboxMessage,
  OutboxStatus,
} from '../outbox.types';

/**
 * In-memory outbox repository for unit tests.
 *
 * Simulates FOR UPDATE SKIP LOCKED and CAS semantics with in-memory arrays.
 */
export class InMemoryOutboxRepository implements OutboxRepositoryPort {
  private rows: OutboxMessage[] = [];

  async append(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    const id = randomUUID();
    const eventId = request.headers?.['event-id'] ?? randomUUID();
    const now = new Date();

    const message: OutboxMessage = {
      id,
      eventId,
      tenantId: request.tenantId ?? null,
      organizationId: request.organizationId ?? null,
      eventType: request.eventType,
      eventVersion: request.eventVersion ?? 1,
      aggregateType: request.aggregateType,
      aggregateId: request.aggregateId,
      payload: request.payload ?? {},
      headers: request.headers ?? null,
      occurredAt: request.occurredAt ?? now,
      createdAt: now,
      status: OutboxStatus.PENDING,
      availableAt: request.occurredAt ?? now,
      attempts: 0,
      claimedAt: null,
      claimToken: null,
      publishedAt: null,
      lastError: null,
      correlationId: request.correlationId ?? null,
      causationId: request.causationId ?? null,
      version: 1,
    };

    this.rows.push(message);
    return message;
  }

  async appendMany(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]> {
    const results: OutboxMessage[] = [];
    for (const request of requests) {
      results.push(await this.append(request));
    }
    return results;
  }

  async claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]> {
    const now = new Date();
    const claimToken = randomUUID();

    const candidates = this.rows
      .filter(
        r =>
          (r.status === OutboxStatus.PENDING || r.status === OutboxStatus.FAILED) &&
          r.attempts < options.maxAttempts &&
          r.availableAt <= now,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, options.batchSize);

    const claimed: OutboxClaimedRecord[] = [];
    for (const row of candidates) {
      row.status = OutboxStatus.CLAIMED;
      row.claimToken = claimToken;
      row.claimedAt = now;
      row.attempts += 1;

      claimed.push({
        id: row.id,
        eventId: row.eventId,
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        eventType: row.eventType,
        eventVersion: row.eventVersion,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        payload: row.payload,
        headers: row.headers,
        occurredAt: row.occurredAt,
        status: row.status,
        attempts: row.attempts,
        claimToken,
        claimedAt: now,
        correlationId: row.correlationId,
        causationId: row.causationId,
      });
    }

    return claimed;
  }

  async markPublished(id: string, claimToken: string): Promise<void> {
    const row = this.rows.find(
      r => r.id === id && r.claimToken === claimToken && r.status === OutboxStatus.CLAIMED,
    );
    if (!row) return;

    row.status = OutboxStatus.PUBLISHED;
    row.publishedAt = new Date();
    row.claimedAt = null;
    row.claimToken = null;
  }

  async markFailed(
    id: string,
    claimToken: string,
    error: string,
    availableAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    const row = this.rows.find(
      r => r.id === id && r.claimToken === claimToken && r.status === OutboxStatus.CLAIMED,
    );
    if (!row) return;

    if (row.attempts >= maxAttempts) {
      row.status = OutboxStatus.DEAD_LETTER;
    } else {
      row.status = OutboxStatus.FAILED;
      row.availableAt = availableAt;
    }
    row.lastError = error;
    row.claimedAt = null;
    row.claimToken = null;
  }

  async releaseExpiredClaims(now: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.status === OutboxStatus.CLAIMED && row.claimedAt && row.claimedAt < now) {
        row.status = OutboxStatus.PENDING;
        row.claimedAt = null;
        row.claimToken = null;
        row.version += 1;
        count++;
      }
    }
    return count;
  }

  async deletePublishedOlderThan(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const before = this.rows.length;
    this.rows = this.rows.filter(
      r => !(r.status === OutboxStatus.PUBLISHED && r.publishedAt && r.publishedAt < cutoff),
    );
    return before - this.rows.length;
  }

  /** Test helper: get all rows. */
  getAll(): readonly OutboxMessage[] {
    return this.rows;
  }

  /** Test helper: clear all rows. */
  clear(): void {
    this.rows = [];
  }
}
