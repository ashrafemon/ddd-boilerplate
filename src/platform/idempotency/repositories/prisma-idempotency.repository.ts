import { Prisma } from '../../../generated/client';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { IdempotencyPort, IdempotencyRef, IdempotencyReservation } from '../ports/idempotency.port';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function scopedTenant(ref: IdempotencyRef): string {
  // NULL vs NULL is distinct in Postgres unique indexes — '' keeps empty
  // tenancy genuinely deduplicating.
  return ref.tenantId ?? '';
}

/**
 * Prisma-backed idempotency ledger. The primary path is a plain INSERT
 * (claim); on constraint conflict an atomic takeover UPDATE re-arms only
 * FAILED/expired rows, so duplicates never race the original into running.
 */
@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async reserve(
    ref: IdempotencyRef,
    options?: { ttlMs?: number },
  ): Promise<IdempotencyReservation> {
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const tenantId = scopedTenant(ref);
    try {
      await this.txHost.tx.idempotencyKey.create({
        data: {
          tenantId,
          scope: ref.scope,
          key: ref.key,
          status: 'IN_PROGRESS',
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
      return { status: 'ACQUIRED' };
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw err;
      }
    }

    const takeover = await this.txHost.tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "idempotency_keys"
      SET "status" = 'IN_PROGRESS',
          "result" = NULL,
          "attempts" = "attempts" + 1,
          "expiresAt" = ${new Date(Date.now() + ttlMs)}
      WHERE "scope" = ${ref.scope}
        AND "tenantId" = ${tenantId}
        AND "key" = ${ref.key}
        AND ("status" = 'FAILED' OR "expiresAt" < now())
      RETURNING "id"`;
    if (takeover.length > 0) {
      return { status: 'ACQUIRED' };
    }

    const existing = await this.txHost.tx.idempotencyKey.findUnique({
      where: { scope_tenantId_key: { scope: ref.scope, tenantId, key: ref.key } },
    });
    if (existing?.status === 'COMPLETED') {
      return { status: 'REPLAY', result: (PrismaJson.asRecord(existing.result) ?? {}).result };
    }
    return { status: 'IN_PROGRESS' };
  }

  async markCompleted(ref: IdempotencyRef, result?: unknown): Promise<void> {
    await this.txHost.tx.idempotencyKey.updateMany({
      where: {
        scope: ref.scope,
        tenantId: scopedTenant(ref),
        key: ref.key,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'COMPLETED',
        // Envelope object keeps scalars (strings/numbers) JSON-column-safe.
        result: PrismaJson.toInput({ result: result ?? null }),
      },
    });
  }

  async markFailed(ref: IdempotencyRef): Promise<void> {
    await this.txHost.tx.idempotencyKey.updateMany({
      where: {
        scope: ref.scope,
        tenantId: scopedTenant(ref),
        key: ref.key,
        status: 'IN_PROGRESS',
      },
      data: { status: 'FAILED' },
    });
  }

  async purgeExpired(): Promise<number> {
    const result = await this.txHost.tx.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
