import { Injectable } from '@nestjs/common';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { DistributedLockIdentity, LockLedgerClaim } from '../../types/locking.types';
import { LockLedgerPort } from '../ports/lock-ledger.port';

interface ClaimRow {
  id: string;
  fencingToken: bigint;
}

/**
 * PostgreSQL adapter for the lock ledger (design `common/03-lock`).
 *
 * Implements `LockLedgerPort`. Every statement uses the **physical** column
 * names (`tenant_id`, `fencing_token`, …) because they are raw SQL.
 *
 * `claim` is the interesting one: a single upsert that only writes when the row
 * is absent or its lease lapsed, incrementing `fencing_token` in the same
 * statement. Postgres evaluates the `WHERE` on the conflicting row under a row
 * lock, so two contenders cannot both see an expired lease — one wins and gets
 * the next token, the other gets no row back.
 */
@Injectable()
export class PrismaLockLedgerRepository implements LockLedgerPort {
  constructor(private readonly prisma: PrismaWriteService) {}

  async claim(
    identity: DistributedLockIdentity,
    lockKey: string,
    ownerToken: string,
    leaseUntil: Date,
  ): Promise<LockLedgerClaim | null> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      INSERT INTO "distributed_locks" (
        "id", "tenant_id", "company_id", "scope", "resource", "lock_key",
        "fencing_token", "owner_token", "lease_until", "acquired_at", "created_at", "updated_at"
      )
      VALUES (
        gen_random_uuid(), ${identity.tenantId}, ${identity.companyId}, ${identity.scope},
        ${identity.resource}, ${lockKey}, 1, ${ownerToken}::uuid, ${leaseUntil}, now(), now(), now()
      )
      ON CONFLICT ("tenant_id", "company_id", "scope", "resource") DO UPDATE
        SET "fencing_token" = "distributed_locks"."fencing_token" + 1,
            "owner_token" = EXCLUDED."owner_token",
            "lease_until" = EXCLUDED."lease_until",
            "acquired_at" = now(),
            "renewed_at" = NULL,
            "updated_at" = now()
        WHERE "distributed_locks"."lease_until" IS NULL
           OR "distributed_locks"."lease_until" < now()
      RETURNING "id", "fencing_token" AS "fencingToken"
    `;

    const row = rows[0];
    if (!row) return null;
    return { lockId: row.id, fencingToken: Number(row.fencingToken) };
  }

  async renew(
    identity: DistributedLockIdentity,
    ownerToken: string,
    leaseUntil: Date,
  ): Promise<LockLedgerClaim | null> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      UPDATE "distributed_locks"
      SET "lease_until" = ${leaseUntil},
          "renewed_at" = now(),
          "updated_at" = now()
      WHERE "tenant_id" = ${identity.tenantId}
        AND "company_id" = ${identity.companyId}
        AND "scope" = ${identity.scope}
        AND "resource" = ${identity.resource}
        AND "owner_token" = ${ownerToken}::uuid
        AND "lease_until" > now()
      RETURNING "id", "fencing_token" AS "fencingToken"
    `;

    const row = rows[0];
    if (!row) return null;
    return { lockId: row.id, fencingToken: Number(row.fencingToken) };
  }

  async release(identity: DistributedLockIdentity, ownerToken: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "distributed_locks"
      SET "owner_token" = NULL,
          "lease_until" = NULL,
          "updated_at" = now()
      WHERE "tenant_id" = ${identity.tenantId}
        AND "company_id" = ${identity.companyId}
        AND "scope" = ${identity.scope}
        AND "resource" = ${identity.resource}
        AND "owner_token" = ${ownerToken}::uuid
    `;
  }
}
