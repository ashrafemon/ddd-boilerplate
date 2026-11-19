import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/client';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import {
  IdempotencyCompletedView,
  IdempotencyIdentity,
  IdempotencyReservation,
  IdempotencyRowView,
} from '../types/idempotency.types';

/**
 * PostgreSQL adapter for the idempotency ledger (design `common/02-idempotency`).
 *
 * Implements `IdempotencyRepositoryPort`; use cases inject the port, never this
 * class. All state transitions are CAS:
 *   insert-as-claim on the unique identity
 *   takeover only after the claim's `lease_until` has passed
 *   complete on id + claimToken + version + IN_PROGRESS
 *   fail deletes the same guarded row
 */
@Injectable()
export class PrismaIdempotencyRepository {
  constructor(private readonly prisma: PrismaWriteService) {}

  async findByIdentity(identity: IdempotencyIdentity): Promise<IdempotencyRowView | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: {
        tenantId_companyId_scope_idempotencyKey: {
          tenantId: identity.tenantId,
          companyId: identity.companyId,
          scope: identity.scope,
          idempotencyKey: identity.key,
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
        leaseUntil: true,
        lastError: true,
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
      leaseUntil: row.leaseUntil,
      lastError: row.lastError,
      expiresAt: row.expiresAt,
    };
  }

  async insertClaim(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    leaseUntil: Date,
    requestHash?: string,
  ): Promise<{ id: string; version: number }> {
    const row = await this.prisma.idempotencyKey.create({
      data: {
        tenantId: identity.tenantId,
        companyId: identity.companyId,
        scope: identity.scope,
        idempotencyKey: identity.key,
        claimToken,
        requestHash: requestHash ?? null,
        expiresAt,
        claimedAt: new Date(),
        leaseUntil,
      },
      select: { id: true, version: true },
    });
    return { id: row.id, version: row.version };
  }

  /**
   * CAS-takeover of an IN_PROGRESS row whose claim lease expired. The
   * `lease_until < now` guard makes concurrent takeovers safe: only one update
   * can observe the stale lease. Rows written before `lease_until` existed
   * fall back to the caller-supplied claim-age cutoff.
   */
  async takeoverExpiredClaim(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
    leaseUntil: Date,
    legacyClaimCutoff: Date,
  ): Promise<{ id: string; version: number } | null> {
    const now = new Date();
    const updated = await this.prisma.idempotencyKey.updateMany({
      where: {
        tenantId: identity.tenantId,
        companyId: identity.companyId,
        scope: identity.scope,
        idempotencyKey: identity.key,
        status: 'IN_PROGRESS',
        OR: [
          { leaseUntil: { lt: now } },
          { leaseUntil: null, claimedAt: { lt: legacyClaimCutoff } },
        ],
      },
      data: {
        claimToken,
        resultJson: Prisma.DbNull,
        expiresAt,
        claimedAt: now,
        leaseUntil,
        lastError: 'claim lease expired — taken over by a later reserve',
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) return null;

    const row = await this.prisma.idempotencyKey.findUnique({
      where: {
        tenantId_companyId_scope_idempotencyKey: {
          tenantId: identity.tenantId,
          companyId: identity.companyId,
          scope: identity.scope,
          idempotencyKey: identity.key,
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
        leaseUntil: null,
        lastError: null,
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
