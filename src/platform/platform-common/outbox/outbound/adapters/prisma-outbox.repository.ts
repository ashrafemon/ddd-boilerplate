import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import {
  AppendOutboxEventRequest,
  ClaimOutboxOptions,
  OutboxClaimedRecord,
  OutboxMessage,
  OutboxStatus,
} from '../../types/outbox.types';
import { OutboxRepositoryPort } from '../ports/outbox.repository.port';

/** Row as Prisma returns it after `create` — physical + Prisma field names. */
interface OutboxStoredRow {
  id: string;
  messageId: string;
  eventName: string;
  eventVersion: number;
  tenantId: string | null;
  companyId: string | null;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number | null;
  payload: unknown;
  headers: unknown;
  occurredAt: Date;
  availableAt: Date | null;
  createdAt: Date;
  status: string;
  attempts: number;
  claimedAt: Date | null;
  claimToken: string | null;
  publishedAt: Date | null;
  lastError: string | null;
  correlationId: string | null;
  causationId: string | null;
  version: number;
}

/** Row as the raw claim query returns it — aliases map back to the contract. */
interface OutboxClaimedRow extends Omit<OutboxStoredRow, 'eventName'> {
  eventType: string;
}

/**
 * PostgreSQL adapter for the transactional outbox.
 *
 * Implements `OutboxRepositoryPort`; use cases inject the port, never this
 * class. Every write happens inside the caller's transaction/CLS scope, and
 * every state transition is CAS-fenced on `claimToken`.
 */
@Injectable()
export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async append(request: AppendOutboxEventRequest): Promise<OutboxMessage> {
    const now = new Date();
    const occurredAt = request.occurredAt ?? now;

    const row = await this.txHost.tx.outboxMessage.create({
      data: {
        id: randomUUID(),
        messageId: request.eventId,
        eventName: request.eventType,
        eventVersion: request.eventVersion ?? 1,
        aggregateType: request.aggregateType,
        aggregateId: request.aggregateId,
        aggregateVersion: request.aggregateVersion ?? null,
        tenantId: request.tenantId ?? null,
        companyId: request.companyId ?? null,
        payload: PrismaJson.toInput(request.payload) as object,
        headers: request.headers ? (request.headers as object) : undefined,
        occurredAt,
        status: 'PENDING',
        availableAt: request.availableAt ?? occurredAt,
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
   * `claim_token` + `claimed_at` and bumps `attempts` but leaves `status` as
   * PENDING (the lease is the in-flight marker; a crashed owner is reclaimed
   * once its lease expires — no reconciler needed).
   *
   * The outbox table is snake_case (`prisma/schema/platform/outbox.prisma`
   * maps every column), so the raw SQL MUST use the physical names — and the
   * RETURNING list aliases them back to camelCase for the mapper.
   */
  async claimBatch(options: ClaimOutboxOptions): Promise<OutboxClaimedRecord[]> {
    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - options.claimLeaseMs);
    const claimToken = randomUUID();

    const rows = await this.txHost.tx.$queryRaw<OutboxClaimedRow[]>`
      UPDATE "outbox_messages" o
      SET "status" = 'PUBLISHING',
          "claim_token" = ${claimToken}::uuid,
          "claimed_at" = now(),
          "attempts" = o."attempts" + 1
      WHERE o."id" IN (
        SELECT "id" FROM "outbox_messages"
        WHERE "status" IN ('PENDING', 'PUBLISHING')
          AND ("available_at" IS NULL OR "available_at" <= ${now})
          AND ("claimed_at" IS NULL OR "claimed_at" <= ${leaseCutoff})
        ORDER BY "occurred_at" ASC
        LIMIT ${options.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        o."id",
        o."message_id" AS "messageId",
        o."tenant_id" AS "tenantId",
        o."company_id" AS "companyId",
        o."event_name" AS "eventType",
        o."event_version" AS "eventVersion",
        o."aggregate_type" AS "aggregateType",
        o."aggregate_id" AS "aggregateId",
        o."aggregate_version" AS "aggregateVersion",
        o."payload",
        o."headers",
        o."occurred_at" AS "occurredAt",
        o."available_at" AS "availableAt",
        o."created_at" AS "createdAt",
        o."status",
        o."attempts",
        o."claimed_at" AS "claimedAt",
        o."claim_token" AS "claimToken",
        o."published_at" AS "publishedAt",
        o."last_error" AS "lastError",
        o."correlation_id" AS "correlationId",
        o."causation_id" AS "causationId",
        o."version"`;

    return rows.map(row => this.toClaimedRecord(row, claimToken));
  }

  /** CAS update: PUBLISHING → PUBLISHED. No-op if ownership was lost. */
  async markPublished(id: string, claimToken: string): Promise<void> {
    await this.txHost.tx.outboxMessage.updateMany({
      where: { id, claimToken, status: 'PUBLISHING' },
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
   * CAS update: back to PENDING with the next `availableAt`, or park
   * DEAD_LETTER once `attempts` exceeds the ceiling.
   */
  async markFailed(
    id: string,
    claimToken: string,
    error: string,
    nextRetryAt: Date,
    maxAttempts: number,
  ): Promise<void> {
    const row = await this.txHost.tx.outboxMessage.findFirst({
      where: { id, claimToken, status: 'PUBLISHING' },
    });
    if (!row) {
      return;
    }

    const isExhausted = row.attempts > maxAttempts;

    await this.txHost.tx.outboxMessage.updateMany({
      where: { id, claimToken, status: 'PUBLISHING' },
      data: {
        status: isExhausted ? 'DEAD_LETTER' : 'PENDING',
        lastError: error,
        availableAt: isExhausted ? row.availableAt : nextRetryAt,
        claimedAt: null,
        claimToken: null,
      },
    });
  }

  /**
   * CAS update: park FAILED for a permanent error (bad broker configuration).
   * Unlike DEAD_LETTER this says "the platform cannot publish this yet", so an
   * operator fixes configuration and re-queues it instead of replaying a poison
   * message.
   */
  async markPermanentlyFailed(id: string, claimToken: string, error: string): Promise<void> {
    await this.txHost.tx.outboxMessage.updateMany({
      where: { id, claimToken, status: 'PUBLISHING' },
      data: {
        status: 'FAILED',
        lastError: error,
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

  private toMessage(row: OutboxStoredRow): OutboxMessage {
    return {
      id: row.id,
      eventId: row.messageId,
      tenantId: row.tenantId,
      companyId: row.companyId,
      eventType: row.eventName,
      eventVersion: row.eventVersion,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      aggregateVersion: row.aggregateVersion,
      payload: (row.payload as Record<string, unknown>) ?? {},
      headers: (row.headers as Record<string, string> | null) ?? null,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
      status: row.status as OutboxStatus,
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

  private toClaimedRecord(row: OutboxClaimedRow, claimToken: string): OutboxClaimedRecord {
    return {
      id: row.id,
      eventId: row.messageId,
      tenantId: row.tenantId,
      companyId: row.companyId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      aggregateVersion: row.aggregateVersion,
      payload: (row.payload as Record<string, unknown>) ?? {},
      headers: (row.headers as Record<string, string> | null) ?? null,
      occurredAt: row.occurredAt,
      availableAt: row.availableAt,
      status: row.status,
      attempts: row.attempts,
      claimToken: (row.claimToken as string) ?? claimToken,
      claimedAt: row.claimedAt ?? new Date(),
      correlationId: row.correlationId,
      causationId: row.causationId,
    };
  }
}
