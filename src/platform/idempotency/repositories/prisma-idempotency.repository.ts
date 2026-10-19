import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaWriteService } from '@infrastructure/database/prisma/prisma-write.service';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import { IdempotencyIdentity, IdempotencyReservation } from '../idempotency.types';

/** Read model of an idempotency row. */
export interface IdempotencyRowView {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  claimToken: string;
  version: number;
  resultJson: unknown;
  requestHash: string | null;
  claimedAt: Date | null;
  expiresAt: Date;
}

/** Result of a successful complete CAS — carries the row TTL for Redis. */
export interface IdempotencyCompletedView {
  expiresAt: Date;
}

/**
 * PostgreSQL-backed idempotency repository (design `common/02-idempotency`).
 *
 * Concrete class injected directly into the use cases — no internal
 * repository port. All state transitions are CAS:
 *   insert-as-claim on the unique identity
 *   takeover only when the live claim lease has expired
 *   complete on id + claimToken + version + IN_PROGRESS
 *   fail deletes the same guarded row
 */
@Injectable()
export class PrismaIdempotencyRepository {
  constructor(private readonly prisma: PrismaWriteService) {}

  async findByIdentity(identity: IdempotencyIdentity): Promise<IdempotencyRowView | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: {
        tenantId_organizationId_scope_key: {
          tenantId: identity.tenantId,
          organizationId: identity.organizationId,
          scope: identity.scope,
          key: identity.key,
        },
      },
      select: {
        id: true,
        status: true,
        claimToken: true,
        version: true,
        resultJson: true,
        requestHash: true,
        claimedAt: true,
        expiresAt: true,
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

  async insertClaim(
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
      select: { id: true, version: true },
    });
    return { id: row.id, version: row.version };
  }

  /**
   * CAS-takeover of an IN_PROGRESS row whose claim lease expired. The
   * `claimedAt < cutoff` guard is what makes concurrent takeovers safe: only
   * one update can observe the stale lease.
   */
  async takeoverExpiredClaim(
    identity: IdempotencyIdentity,
    claimToken: string,
    cutoff: Date,
    expiresAt: Date,
  ): Promise<{ id: string; version: number } | null> {
    const updated = await this.prisma.idempotencyKey.updateMany({
      where: {
        tenantId: identity.tenantId,
        organizationId: identity.organizationId,
        scope: identity.scope,
        key: identity.key,
        status: 'IN_PROGRESS',
        claimedAt: { lt: cutoff },
      },
      data: {
        claimToken,
        resultJson: Prisma.DbNull,
        expiresAt,
        claimedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) return null;

    const row = await this.prisma.idempotencyKey.findUnique({
      where: {
        tenantId_organizationId_scope_key: {
          tenantId: identity.tenantId,
          organizationId: identity.organizationId,
          scope: identity.scope,
          key: identity.key,
        },
      },
      select: { id: true, version: true },
    });
    return row ? { id: row.id, version: row.version } : null;
  }

  /** CAS: IN_PROGRESS → COMPLETED. Returns the row TTL on success. */
  async completeCas(
    reservation: IdempotencyReservation,
    result: unknown,
  ): Promise<IdempotencyCompletedView | null> {
    const updated = await this.prisma.idempotencyKey.updateMany({
      where: {
        id: reservation.id,
        claimToken: reservation.claimToken,
        version: reservation.version,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'COMPLETED',
        resultJson: PrismaJson.toInput(result as object) ?? Prisma.JsonNull,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) return null;

    const row = await this.prisma.idempotencyKey.findUnique({
      where: { id: reservation.id },
      select: { expiresAt: true },
    });
    return row ? { expiresAt: row.expiresAt } : null;
  }

  /** CAS-delete: releases the claim so the next reserve starts clean. */
  async failDeleteCas(reservation: IdempotencyReservation): Promise<boolean> {
    const deleted = await this.prisma.idempotencyKey.deleteMany({
      where: {
        id: reservation.id,
        claimToken: reservation.claimToken,
        version: reservation.version,
        status: 'IN_PROGRESS',
      },
    });
    return deleted.count > 0;
  }

  /** Hourly reconciliation: delete expired IN_PROGRESS + COMPLETED rows. */
  async purgeExpired(now: Date): Promise<number> {
    const deleted = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return deleted.count;
  }
}
