import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { InboxIdentity, InboxMessage } from '../inbox.types';

const UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION;
}

interface InboxRawRow {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  messageId: string;
  messageType: string;
  payload: unknown;
  status: string;
  attempts: number;
  claimToken: string;
  claimedAt: Date | null;
  processedAt: Date | null;
  nextAttemptAt: Date | null;
  lastError: string | null;
  correlationId: string | null;
  causationId: string | null;
}

export interface InsertInboxMessageInput {
  identity: InboxIdentity;
  messageType: string;
  payload: unknown;
  claimToken: string;
  claimedAt: Date;
  correlationId: string | null;
  causationId: string | null;
}

/**
 * Concrete inbox repository (design 07: no internal port). INSERT-as-claim on
 * the unique identity, CAS writes fenced on `claimToken`, and one reconcile
 * sweep that parks poison and backoffs the rest.
 */
@Injectable()
export class PrismaInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  /** Insert-as-claim; a duplicate returns `null` (never a read-then-write). */
  async insertIfAbsent(input: InsertInboxMessageInput): Promise<{ id: string } | null> {
    try {
      const row = await this.txHost.tx.inboxMessage.create({
        data: {
          tenantId: input.identity.tenantId,
          companyId: input.identity.companyId,
          consumer: input.identity.consumer,
          messageId: input.identity.messageId,
          messageType: input.messageType,
          payload: PrismaJson.toInput(input.payload as object) as Prisma.InputJsonValue,
          status: 'IN_PROGRESS',
          attempts: 1,
          claimToken: input.claimToken,
          claimedAt: input.claimedAt,
          correlationId: input.correlationId,
          causationId: input.causationId,
        },
      });
      return { id: row.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }
  }

  async findUnique(identity: InboxIdentity): Promise<InboxMessage | null> {
    const row = await this.txHost.tx.inboxMessage.findUnique({
      where: {
        tenantId_companyId_consumer_messageId: {
          tenantId: identity.tenantId,
          companyId: identity.companyId,
          consumer: identity.consumer,
          messageId: identity.messageId,
        },
      },
    });
    return row ? this.toRecord(row) : null;
  }

  /** CAS re-claim of a due retry; only one racer wins on the previous token. */
  reclaim(id: string, previousClaimToken: string, claimToken: string, now: Date): Promise<boolean> {
    return this.txHost.tx.inboxMessage
      .updateMany({
        where: { id, claimToken: previousClaimToken, status: 'IN_PROGRESS' },
        data: {
          claimToken,
          claimedAt: now,
          nextAttemptAt: null,
          attempts: { increment: 1 },
        },
      })
      .then(r => r.count > 0);
  }

  /** CAS: IN_PROGRESS → PROCESSED. */
  complete(id: string, claimToken: string): Promise<boolean> {
    return this.txHost.tx.inboxMessage
      .updateMany({
        where: { id, claimToken, status: 'IN_PROGRESS' },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          claimedAt: null,
          nextAttemptAt: null,
        },
      })
      .then(r => r.count > 0);
  }

  /**
   * CAS: keep IN_PROGRESS with an exponential backoff `nextAttemptAt`
   * (from the row's own `attempts`); the broker redelivers and `receive`
   * re-claims once it is due.
   */
  fail(
    id: string,
    claimToken: string,
    lastError: string | null,
    retryBaseDelayMs: number,
    retryMaxDelayMs: number,
  ): Promise<boolean> {
    const base = Math.max(retryBaseDelayMs, 0);
    const max = Math.max(retryMaxDelayMs, base);
    const now = new Date();
    // The numeric casts matter: Prisma sends JS numbers as untyped parameters,
    // and `LEAST($1, $2)` then resolves to `interval` — which Postgres refuses
    // to add to a `timestamp` column ("expression is of type interval").
    return this.txHost.tx.$executeRaw`
      UPDATE "inbox_messages"
      SET "claimed_at" = NULL,
          "last_error" = ${lastError},
          "next_attempt_at" = ${now}::timestamp + (
            LEAST(
              ${base}::numeric * POWER(2, GREATEST("attempts" - 1, 0)),
              ${max}::numeric
            )
            * INTERVAL '1 millisecond'
          )
      WHERE "id" = ${id}::uuid
        AND "claim_token" = ${claimToken}::uuid
        AND "status" = 'IN_PROGRESS'`.then(n => Number(n) > 0);
  }

  /**
   * Reconcile sweep: park expired poison as SUSPENDED (`attempts > maxAttempts`)
   * and give the rest a fresh exponential backoff. Returns rows touched.
   */
  async reconcileExpiredClaims(
    now: Date,
    leaseMs: number,
    maxAttempts: number,
    retryBaseDelayMs: number,
    retryMaxDelayMs: number,
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - leaseMs);

    const suspended = await this.txHost.tx.inboxMessage.updateMany({
      where: { status: 'IN_PROGRESS', claimedAt: { lt: cutoff }, attempts: { gt: maxAttempts } },
      data: { status: 'SUSPENDED', claimedAt: null, lastError: 'max attempts exceeded' },
    });

    const backoffBase = Math.max(retryBaseDelayMs, 0);
    const backoffMax = Math.max(retryMaxDelayMs, backoffBase);
    // The numeric casts matter: Prisma sends JS numbers as untyped parameters,
    // and `LEAST($1, $2)` then resolves to `interval` — which Postgres refuses
    // to add to a `timestamp` column ("expression is of type interval").
    const backoffed = await this.txHost.tx.$executeRaw`
      UPDATE "inbox_messages"
      SET "claimed_at" = NULL,
          "next_attempt_at" = ${now}::timestamp + (
            LEAST(
              ${backoffBase}::numeric * POWER(2, GREATEST("attempts" - 1, 0)),
              ${backoffMax}::numeric
            )
            * INTERVAL '1 millisecond'
          )
      WHERE "status" = 'IN_PROGRESS'
        AND "claimed_at" IS NOT NULL
        AND "claimed_at" < ${cutoff}
        AND "attempts" <= ${maxAttempts}`;

    return suspended.count + Number(backoffed);
  }

  /** Delete PROCESSED rows past retention; SUSPENDED rows never purge. */
  async deleteProcessedOlderThan(retentionMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const result = await this.txHost.tx.inboxMessage.deleteMany({
      where: { status: 'PROCESSED', processedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toRecord(row: InboxRawRow): InboxMessage {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      consumer: row.consumer,
      messageId: row.messageId,
      messageType: row.messageType,
      payload: row.payload,
      status: row.status,
      attempts: row.attempts,
      claimToken: row.claimToken,
      claimedAt: row.claimedAt,
      processedAt: row.processedAt,
      nextAttemptAt: row.nextAttemptAt,
      lastError: row.lastError,
      correlationId: row.correlationId,
      causationId: row.causationId,
    };
  }
}
