import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { IntegrationMessage } from '@platform/messaging/ports/message-publisher.port';

export interface OutboxMessageRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  occurredAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
  status: 'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
}

export abstract class OutboxRepository {
  abstract save(message: IntegrationMessage): Promise<void>;
  abstract claimBatch(batchSize: number): Promise<OutboxMessageRecord[]>;
  abstract markPublished(id: string): Promise<void>;
  abstract markFailed(id: string, error: string): Promise<void>;
  abstract retryFailed(limit: number): Promise<number>;
  abstract deletePublishedOlderThan(hours: number): Promise<number>;
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
        payload: toPrismaJson(message.payload),
        headers: message.headers ? toPrismaJson(message.headers) : undefined,
        occurredAt: message.occurredAt,
        status: 'PENDING',
      },
    });
  }

  public async claimBatch(batchSize: number): Promise<OutboxMessageRecord[]> {
    return this.txHost.tx.$transaction(async tx => {
      const rows = await tx.outboxMessage.findMany({
        where: { status: { in: ['PENDING', 'FAILED'] } },
        orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
        take: batchSize,
      });

      await tx.outboxMessage.updateMany({
        where: { id: { in: rows.map(row => row.id) } },
        data: { status: 'PUBLISHING' },
      });

      return rows.map(row => this.toRecord(row));
    });
  }

  public async markPublished(id: string): Promise<void> {
    await this.txHost.tx.outboxMessage.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  public async markFailed(id: string, error: string): Promise<void> {
    await this.txHost.tx.outboxMessage.update({
      where: { id },
      data: { status: 'FAILED', lastError: error, attempts: { increment: 1 } },
    });
  }

  public async retryFailed(limit: number): Promise<number> {
    const result = await this.txHost.tx.outboxMessage.updateMany({
      where: { status: 'FAILED', attempts: { lt: limit } },
      data: { status: 'PENDING' },
    });
    return result.count;
  }

  public async deletePublishedOlderThan(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await this.txHost.tx.outboxMessage.deleteMany({
      where: { status: 'PUBLISHED', publishedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toRecord(row: {
    id: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    headers: unknown;
    occurredAt: Date;
    publishedAt: Date | null;
    attempts: number;
    lastError: string | null;
    status: string;
  }): OutboxMessageRecord {
    return {
      id: row.id,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
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

function toPrismaJson(value: Record<string, unknown>): object {
  return JSON.parse(JSON.stringify(value)) as object;
}
