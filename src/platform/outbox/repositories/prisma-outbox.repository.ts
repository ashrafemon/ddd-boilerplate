import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import {
  AppendOutboxEventRequest,
  ClaimOutboxOptions,
  OutboxClaimedRecord,
  OutboxMessage,
  OutboxStatus,
} from '../outbox.types';

interface OutboxRawRow {
  id: string;
  eventId: string;
  tenantId: string | null;
  organizationId: string | null;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  headers: unknown;
  occurredAt: Date;
  createdAt: Date;
  status: string;
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

/**
 * Concrete Outbox persistence (no internal repository port — injected
 * directly into the outbox use cases). Every write happens inside the caller's
 * transaction/CLS scope; every state transition is CAS-fenced on `claimToken`.
 */
@Injectable()
export class PrismaOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async append(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    const now = new Date();
    const occurredAt = request.occurredAt ?? now;

    const row = await this.txHost.tx.outboxMessage.create({
      data: {
        id: randomUUID(),
        eventId: request.eventId,
        eventType: request.eventType,
        eventVersion: request.eventVersion ?? 1,
        aggregateType: request.aggregateType,
        aggregateId: request.aggregateId,
        tenantId: request.tenantId ?? null,
        organizationId: request.organizationId ?? null,
        payload: PrismaJson.toInput(request.payload) as object,
        headers: request.headers ? (request.headers as object) : undefined,
        occurredAt,
        status: 'PENDING',
        nextRetryAt: request.nextRetryAt ?? occurredAt,
        correlationId: request.correlationId ?? null,
        causationId: request.causationId ?? null,
        claimToken: null,
        claimedAt: null,
        publishedAt: null,
        lastError: null,
        attempts: 0,
        version: 1,
      },
    });

    return this.toMessage(row);
  }

  /**
   * Race-safe claim: FOR UPDATE SKIP LOCKED over due PENDING rows. Stamps
   * `claimToken` + `claimedAt` and bumps `attempts` but leaves `status` as
   * PENDING (the lease is the in-flight marker; a crashed owner is reclaimed
   * once its lease expires — no reconciler needed).
   */
  async claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]> {
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - options.claimLeaseMs);
    const claimToken = randomUUID();

    const rows = await this.txHost.tx.$queryRaw<OutboxRawRow[]>`
      UPDATE "outbox_messages" o
      SET "claimToken" = ${claimToken}::uuid,
          "claimedAt" = now(),
          "attempts" = o."attempts" + 1
      WHERE o."id" IN (
        SELECT "id" FROM "outbox_messages"
        WHERE "status" = 'PENDING'
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
          AND ("claimedAt" IS NULL OR "claimedAt" <= ${leaseCutoff})
        ORDER BY "createdAt" ASC
        LIMIT ${options.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;

    return rows.map(row => this.toClaimedRecord(row, claimToken));
  }

  /** CAS update: PENDING → PUBLISHED. No-op if ownership was lost. */
  async markPublished(id: string, claimToken: string): Promise<void> {
    await this.txHost.tx.outboxMessage.updateMany({
      where: { id, claimToken, status: 'PENDING' },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        claimedAt: null,
        claimToken: null,
        lastError: null,
      },
    });
  }

  /**
   * CAS update: keep PENDING with the next retry time, or park DEAD_LETTER
   * once attempts exceed the ceiling.
   */
  async markFailed(
    id: string,
    claimToken: string,
    error: string,
    nextRetryAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    const row = await this.txHost.tx.outboxMessage.findFirst({
      where: { id, claimToken, status: 'PENDING' },
    });
    if (!row) {
      return;
    }

    const isExhausted = row.attempts > maxAttempts;

    await this.txHost.tx.outboxMessage.updateMany({
      where: { id, claimToken, status: 'PENDING' },
      data: {
        status: isExhausted ? 'DEAD_LETTER' : 'PENDING',
        lastError: error,
        nextRetryAt: isExhausted ? row.nextRetryAt : nextRetryAt,
        claimedAt: null,
        claimToken: null,
      },
    });
  }

  /** Delete PUBLISHED rows past the retention window. Returns deleted count. */
  async deletePublishedOlderThan(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.txHost.tx.outboxMessage.deleteMany({
      where: { status: 'PUBLISHED', publishedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toMessage(row: OutboxRawRow): OutboxMessage {
    return {
      id: row.id,
      eventId: row.eventId,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payload: (row.payload as Record<string, unknown>) ?? {},
      headers: (row.headers as Record<string, string> | null) ?? null,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
      status: row.status as OutboxStatus,
      nextRetryAt: row.nextRetryAt,
      attempts: row.attempts,
      claimedAt: row.claimedAt,
      claimToken: row.claimToken,
      publishedAt: row.publishedAt,
      lastError: row.lastError,
      correlationId: row.correlationId,
      causationId: row.causationId,
      version: row.version,
    };
  }

  private toClaimedRecord(row: OutboxRawRow, claimToken: string): OutboxClaimedRecord {
    return {
      id: row.id,
      eventId: row.eventId,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payload: (row.payload as Record<string, unknown>) ?? {},
      headers: (row.headers as Record<string, string> | null) ?? null,
      occurredAt: row.occurredAt,
      status: row.status,
      attempts: row.attempts,
      claimToken: (row.claimToken as string) ?? claimToken,
      claimedAt: row.claimedAt ?? new Date(),
      correlationId: row.correlationId,
      causationId: row.causationId,
    };
  }
}
