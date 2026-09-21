import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';
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

@Injectable()
export class PrismaOutboxRepository extends OutboxRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async append(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    const id = randomUUID();
    const eventId = request.headers?.['event-id'] ?? randomUUID();
    const now = new Date();

    const row = await this.txHost.tx.outboxMessage.create({
      data: {
        id,
        eventType: request.eventType,
        eventVersion: request.eventVersion ?? 1,
        aggregateType: request.aggregateType,
        aggregateId: request.aggregateId,
        tenantId: request.tenantId ?? null,
        organizationId: request.organizationId ?? null,
        payload: PrismaJson.toInput(request.payload ?? {}) as object,
        headers: request.headers ? (request.headers as object) : undefined,
        occurredAt: request.occurredAt ?? now,
        status: 'PENDING',
        availableAt: request.occurredAt ?? now,
        correlationId: request.correlationId ?? null,
        causationId: request.causationId ?? null,
        eventId,
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

  async appendMany(requests: AppendOutboxEventRequest[]): Promise<OutboxMessage[]> {
    const results: OutboxMessage[] = [];
    for (const request of requests) {
      results.push(await this.append(request));
    }
    return results;
  }

  async claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]> {
    const dueBefore = new Date();
    const claimToken = randomUUID();

    const rows = await this.txHost.tx.$queryRaw<OutboxRawRow[]>`
      UPDATE "outbox_messages" o
      SET "status" = 'PUBLISHING',
          "claimToken" = ${claimToken}::uuid,
          "claimedAt" = now(),
          "attempts" = o."attempts" + 1
      WHERE o."id" IN (
        SELECT "id" FROM "outbox_messages"
        WHERE "status" IN ('PENDING', 'FAILED')
          AND "attempts" < ${options.maxAttempts}
          AND "availableAt" <= ${dueBefore}
        ORDER BY "createdAt" ASC
        LIMIT ${options.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;

    return rows.map(row => this.toClaimedRecord(row, claimToken));
  }

  async markPublished(id: string, claimToken: string): Promise<void> {
    await this.txHost.tx.outboxMessage.updateMany({
      where: {
        id,
        claimToken,
        status: 'PUBLISHING',
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        claimedAt: null,
        claimToken: null,
      },
    });
  }

  async markFailed(
    id: string,
    claimToken: string,
    error: string,
    availableAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    // First read the row to check attempts
    const row = await this.txHost.tx.outboxMessage.findFirst({
      where: { id, claimToken, status: 'PUBLISHING' },
    });

    if (!row) return;

    const isExhausted = row.attempts >= maxAttempts;

    await this.txHost.tx.outboxMessage.updateMany({
      where: {
        id,
        claimToken,
        status: 'PUBLISHING',
      },
      data: {
        status: isExhausted ? 'DEAD_LETTER' : 'FAILED',
        lastError: error,
        availableAt: isExhausted ? row.availableAt : availableAt,
        claimedAt: null,
        claimToken: null,
      },
    });
  }

  async releaseExpiredClaims(now: Date): Promise<number> {
    // The caller (ReleaseOutboxClaimUseCase) receives `now`, but we need the
    // lease duration from config. Since the repository port doesn't take
    // leaseMs (the reconciler reads config itself), we use the configured
    // default. The reconciler passes `now` and the repository releases
    // everything that was claimed before the lease window.
    //
    // We re-introduce the lease parameter at the repository level for
    // flexibility — the use case passes it through.
    //
    // NOTE: The repository port signature has `now` only; the leaseMs is
    // read by the reconciler and subtracted from `now` before calling.
    return this.txHost.tx.$executeRaw`
      UPDATE "outbox_messages"
      SET "status" = 'PENDING', "claimedAt" = NULL, "claimToken" = NULL
      WHERE "status" = 'PUBLISHING'
        AND "claimedAt" < ${now}`;
  }

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
      status: this.mapStatus(row.status),
      availableAt: row.availableAt,
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

  private mapStatus(dbStatus: string): OutboxStatus {
    switch (dbStatus) {
      case 'PUBLISHING':
        return OutboxStatus.CLAIMED;
      case 'PUBLISHED':
        return OutboxStatus.PUBLISHED;
      case 'FAILED':
        return OutboxStatus.FAILED;
      case 'DEAD_LETTER':
        return OutboxStatus.DEAD_LETTER;
      default:
        return OutboxStatus.PENDING;
    }
  }
}
