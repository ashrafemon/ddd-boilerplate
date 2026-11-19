import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../../generated/client';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import { SagaInboxRecord, SagaInboxStatus } from '../types/saga-inbox.types';

/** Values needed to buffer one delivered event for an instance. */
export interface InsertInboxInput {
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string | null;
  headers?: Record<string, string> | null;
}

const UNIQUE_VIOLATION = 'P2002';

interface InboxRow {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: unknown;
  payloadHash: string | null;
  status: string;
  attempts: number;
  receivedAt: Date;
  nextAttemptAt: Date | null;
  lastError: string | null;
}

/**
 * PostgreSQL adapter for `saga_inbox` (workbook column set: `consumer_key`,
 * `message_id`, `payload_hash`, `headers`, `attempts`).
 */
@Injectable()
export class PrismaSagaInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async tryInsert(input: InsertInboxInput): Promise<SagaInboxRecord | null> {
    try {
      const row = await this.txHost.tx.sagaInbox.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          companyId: input.companyId,
          consumer: input.consumer,
          eventId: input.eventId,
          eventName: input.eventName,
          eventVersion: input.eventVersion,
          correlationKey: input.correlationKey,
          instanceId: input.instanceId,
          payload: PrismaJson.toInput(input.payload) as Prisma.InputJsonValue,
          payloadHash: input.payloadHash,
          headers: input.headers ? (input.headers as object) : undefined,
          status: SagaInboxStatus.RECEIVED,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
        return null;
      }
      throw err;
    }
  }

  async markBuffered(
    id: string,
    correlationKey: string | null,
    instanceId: string | null,
  ): Promise<void> {
    await this.txHost.tx.sagaInbox.updateMany({
      where: { id },
      data: { status: SagaInboxStatus.BUFFERED, correlationKey, instanceId },
    });
  }

  async markConsumed(id: string): Promise<boolean> {
    const result = await this.txHost.tx.sagaInbox.updateMany({
      where: { id, status: SagaInboxStatus.BUFFERED },
      data: { status: SagaInboxStatus.CONSUMED, processedAt: new Date() },
    });
    return result.count === 1;
  }

  async ignoreBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    reason: string,
  ): Promise<number> {
    const result = await this.txHost.tx.sagaInbox.updateMany({
      where: {
        instanceId,
        eventName,
        eventVersion,
        status: SagaInboxStatus.BUFFERED,
      },
      data: { status: SagaInboxStatus.IGNORED, reason, processedAt: new Date() },
    });
    return result.count;
  }

  async listBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]> {
    const rows = await this.txHost.tx.sagaInbox.findMany({
      where: {
        instanceId,
        eventName,
        eventVersion,
        status: SagaInboxStatus.BUFFERED,
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row));
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.txHost.tx.sagaInbox.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toRecord(row: InboxRow): SagaInboxRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      consumer: row.consumer,
      eventId: row.eventId,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      correlationKey: row.correlationKey,
      instanceId: row.instanceId,
      payload: (row.payload as Record<string, unknown>) ?? {},
      payloadHash: row.payloadHash,
      status: row.status as SagaInboxStatus,
      attempts: row.attempts,
      receivedAt: row.receivedAt,
      nextAttemptAt: row.nextAttemptAt,
      lastError: row.lastError,
    };
  }
}
