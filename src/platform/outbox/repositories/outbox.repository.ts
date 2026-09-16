import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';
import { OutboxMessageRecord, OutboxRepository } from '../ports/outbox-repository.port';

interface OutboxRawRow {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string | null;
  payload: unknown;
  headers: unknown;
  occurredAt: Date;
  publishedAt: Date | null;
  claimedAt: Date | null;
  nextRetryAt: Date | null;
  attempts: number;
  lastError: string | null;
  status: string;
  createdAt: Date;
}

@Injectable()
export class PrismaOutboxRepository extends OutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  public async save(message: IntegrationMessage): Promise<void> {
    await this.txHost.tx.outboxMessage.create({
      data: {
        eventType: message.eventType,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        tenantId: message.tenantId ?? null,
        payload: PrismaJson.toInput(message.payload) as object,
        headers: message.headers ? PrismaJson.toInput(message.headers) : undefined,
        occurredAt: message.occurredAt,
        status: 'PENDING',
      },
    });
  }

  public async claimBatch(batchSize: number, maxAttempts: number): Promise<OutboxMessageRecord[]> {
    const dueBefore = new Date();
    const rows = await this.txHost.tx.$queryRaw<OutboxRawRow[]>`
      UPDATE "outbox_messages" o
      SET "status" = 'PUBLISHING',
          "claimedAt" = now(),
          "attempts" = o."attempts" + 1
      WHERE o."id" IN (
        SELECT "id" FROM "outbox_messages"
        WHERE "status" IN ('PENDING', 'FAILED')
          AND "attempts" < ${maxAttempts}
          AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${dueBefore})
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;
    return rows.map(row => this.toRecord(row));
  }

  public async markPublished(id: string): Promise<void> {
    await this.txHost.tx.outboxMessage.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), claimedAt: null },
    });
  }

  public async markFailed(
    id: string,
    error: string,
    retry: { maxAttempts: number; backoffBaseMs: number },
  ): Promise<void> {
    await this.txHost.tx.$executeRaw`
      UPDATE "outbox_messages"
      SET "status" = CASE
            WHEN "attempts" >= ${retry.maxAttempts} THEN 'DEAD_LETTER'::"OutboxMessageStatus"
            ELSE 'FAILED'::"OutboxMessageStatus"
          END,
          "lastError" = ${error},
          "nextRetryAt" = CASE
            WHEN "attempts" >= ${retry.maxAttempts} THEN NULL
            ELSE now() + ${retry.backoffBaseMs} * power(2, "attempts" - 1) * interval '1 millisecond'
          END,
          "claimedAt" = NULL
      WHERE "id" = ${id}::uuid`;
  }

  public async reconcileStaleClaims(leaseMs: number): Promise<number> {
    return this.txHost.tx.$executeRaw`
      UPDATE "outbox_messages"
      SET "status" = 'PENDING', "claimedAt" = NULL
      WHERE "status" = 'PUBLISHING'
        AND "claimedAt" < now() - ${leaseMs} * interval '1 millisecond'`;
  }

  public async deletePublishedOlderThan(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.txHost.tx.outboxMessage.deleteMany({
      where: { status: 'PUBLISHED', publishedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toRecord(row: OutboxRawRow): OutboxMessageRecord {
    return {
      id: row.id,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      tenantId: row.tenantId,
      payload: (row.payload as Record<string, unknown>) ?? {},
      headers: (row.headers as Record<string, string> | null) ?? null,
      occurredAt: row.occurredAt,
      publishedAt: row.publishedAt,
      attempts: row.attempts,
      lastError: row.lastError,
      status: row.status as OutboxMessageRecord['status'],
    };
  }
}
