import { Injectable } from '@nestjs/common';
import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxReceiveRequest, InboxMessage, ClaimInboxOptions } from '../inbox.types';

/**
 * PostgreSQL-backed inbox repository.
 *
 * - Insert-as-claim on (tenantId, organizationId, consumer, messageId)
 * - CAS updates with claim token + version for ownership validation
 * - FOR UPDATE SKIP LOCKED for retry claiming
 * - Reconciliation of expired claims
 */
@Injectable()
export class PrismaInboxRepository implements InboxRepositoryPort {
  constructor(private readonly prisma: PrismaWriteService) {}

  async findUnique(
    tenantId: string,
    organizationId: string,
    consumer: string,
    messageId: string,
  ): Promise<InboxMessage | null> {
    const row = await this.prisma.inboxMessage.findUnique({
      where: {
        tenantId_organizationId_consumer_messageId: {
          tenantId,
          organizationId,
          consumer,
          messageId,
        },
      },
    });
    if (!row) return null;
    return this.toInboxMessage(row);
  }

  async insert(
    request: InboxReceiveRequest,
    claimToken: string,
    payloadHash: string | null,
  ): Promise<{ id: string; version: number }> {
    const tenantId = request.tenantId ?? '';
    const organizationId = request.organizationId ?? '';
    const now = new Date();

    const row = await this.prisma.inboxMessage.create({
      data: {
        tenantId,
        organizationId,
        consumer: request.consumer,
        messageId: request.messageId,
        messageType: request.messageType,
        messageVersion: request.messageVersion ?? 1,
        payloadHash,
        payload: JSON.parse(JSON.stringify(request.payload ?? null)) as never,
        occurredAt: request.occurredAt ?? null,
        status: 'IN_PROGRESS',
        claimToken,
        claimedAt: now,
        correlationId: request.correlationId ?? null,
        causationId: request.causationId ?? null,
      },
    });
    return { id: row.id, version: row.version };
  }

  async complete(id: string, claimToken: string, version: number): Promise<boolean> {
    const update = await this.prisma.inboxMessage.updateMany({
      where: {
        id,
        claimToken,
        version,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return update.count > 0;
  }

  async fail(
    id: string,
    claimToken: string,
    version: number,
    errorCode?: string,
    errorMessage?: string,
    nextAttemptAt?: Date,
  ): Promise<boolean> {
    const update = await this.prisma.inboxMessage.updateMany({
      where: {
        id,
        claimToken,
        version,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'FAILED',
        errorCode: errorCode ?? null,
        errorMessage: errorMessage ?? null,
        nextAttemptAt: nextAttemptAt ?? null,
        lastError: errorMessage ?? null,
        version: { increment: 1 },
      },
    });
    return update.count > 0;
  }

  async claimRetryable(options: ClaimInboxOptions): Promise<InboxMessage[]> {
    const now = new Date();
    const rows = await this.prisma.$queryRaw<InboxRawRow[]>`
      UPDATE "inbox_messages" i
      SET "status" = 'IN_PROGRESS',
          "claim_token" = gen_random_uuid(),
          "claimed_at" = ${now},
          "version" = i."version" + 1
      WHERE i."id" IN (
        SELECT "id" FROM "inbox_messages"
        WHERE "status" = 'FAILED'
          AND "next_attempt_at" <= ${now}
        ORDER BY "received_at" ASC
        LIMIT ${options.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;
    return rows.map(row => this.toInboxMessage(row));
  }

  async releaseExpiredClaims(now: Date, claimLeaseMs: number): Promise<number> {
    const cutoff = new Date(now.getTime() - claimLeaseMs);
    const result = await this.prisma.inboxMessage.updateMany({
      where: {
        status: 'IN_PROGRESS',
        claimedAt: { lt: cutoff },
      },
      data: {
        status: 'FAILED',
        claimToken: '',
        claimedAt: null,
        version: { increment: 1 },
      },
    });
    return result.count;
  }

  private toInboxMessage(row: InboxRawRow): InboxMessage {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      consumer: row.consumer,
      messageId: row.messageId,
      messageType: row.messageType,
      messageVersion: row.messageVersion,
      payloadHash: row.payloadHash,
      payload: row.payload,
      occurredAt: row.occurredAt,
      receivedAt: row.receivedAt,
      status: row.status,
      attempts: row.attempts,
      claimToken: row.claimToken,
      claimedAt: row.claimedAt,
      processedAt: row.processedAt,
      nextAttemptAt: row.nextAttemptAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      lastError: row.lastError,
      correlationId: row.correlationId,
      causationId: row.causationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    };
  }
}

interface InboxRawRow {
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
