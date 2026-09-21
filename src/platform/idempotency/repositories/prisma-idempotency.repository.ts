import { Injectable } from '@nestjs/common';
import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
import { IdempotencyRepositoryPort } from '../ports/idempotency-repository.port';
import { IdempotencyIdentity } from '../idempotency.types';

/**
 * PostgreSQL-backed idempotency repository.
 *
 * - Insert-as-claim on (tenantId, organizationId, scope, key)
 * - Atomic takeover of FAILED/SUSPENDED/expired rows
 * - CAS updates with claim token + version for ownership validation
 * - Reconciliation of expired IN_PROGRESS claims
 */
@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyRepositoryPort {
  constructor(private readonly prisma: PrismaWriteService) {}

  async findUnique(identity: IdempotencyIdentity) {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: {
        tenantId_organizationId_scope_key: {
          tenantId: identity.tenantId,
          organizationId: identity.organizationId,
          scope: identity.scope,
          key: identity.key,
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      claimToken: row.claimToken,
      version: row.version,
      resultJson: row.resultJson,
      requestHash: row.requestHash,
      claimedAt: row.claimedAt,
      expiresAt: row.expiresAt,
    };
  }

  async insert(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    requestHash?: string,
  ): Promise<{ id: string; version: number }> {
    const row = await this.prisma.idempotencyKey.create({
      data: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        scope: identity.scope,
        key: identity.key,
        claimToken,
        requestHash: requestHash ?? null,
        expiresAt,
        claimedAt: new Date(),
      },
    });
    return { id: row.id, version: row.version };
  }

  async takeover(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.idempotencyKey.updateMany({
      where: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        scope: identity.scope,
        key: identity.key,
        OR: [{ status: 'FAILED' }, { status: 'SUSPENDED' }, { expiresAt: { lt: new Date() } }],
      },
      data: {
        status: 'IN_PROGRESS',
        claimToken,
        resultJson: undefined,
        errorCode: undefined,
        errorMessage: undefined,
        expiresAt,
        claimedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return result.count > 0;
  }

  async complete(
    id: string,
    claimToken: string,
    version: number,
    result: unknown,
  ): Promise<boolean> {
    const update = await this.prisma.idempotencyKey.updateMany({
      where: {
        id,
        claimToken,
        version,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'COMPLETED',
        resultJson: result as Record<string, unknown>,
        completedAt: new Date(),
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
  ): Promise<boolean> {
    const update = await this.prisma.idempotencyKey.updateMany({
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
        version: { increment: 1 },
      },
    });
    return update.count > 0;
  }

  async suspendExpiredClaims(claimLeaseMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - claimLeaseMs);
    const result = await this.prisma.idempotencyKey.updateMany({
      where: {
        status: 'IN_PROGRESS',
        claimedAt: { lt: cutoff },
      },
      data: {
        status: 'SUSPENDED',
        version: { increment: 1 },
      },
    });
    return result.count;
  }

  async purgeExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
