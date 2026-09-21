import { randomUUID } from 'crypto';
import { IdempotencyRepositoryPort } from '../ports/idempotency-repository.port';
import { IdempotencyIdentity } from '../idempotency.types';

interface IdempotencyRow {
  id: string;
  status: string;
  claimToken: string;
  version: number;
  resultJson: unknown;
  requestHash: string | null;
  claimedAt: Date | null;
  expiresAt: Date;
  tenantId: string;
  organizationId: string;
  scope: string;
  key: string;
}

/**
 * In-memory idempotency repository for unit tests.
 */
export class InMemoryIdempotencyRepository implements IdempotencyRepositoryPort {
  private rows: IdempotencyRow[] = [];

  async findUnique(identity: IdempotencyIdentity) {
    const row = this.rows.find(
      (r) =>
        r.tenantId === identity.tenantId &&
        r.organizationId === identity.organizationId &&
        r.scope === identity.scope &&
        r.key === identity.key,
    );
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
    const existing = this.rows.find(
      (r) =>
        r.tenantId === identity.tenantId &&
        r.organizationId === identity.organizationId &&
        r.scope === identity.scope &&
        r.key === identity.key,
    );
    if (existing) {
      throw new Error('Unique constraint violation');
    }
    const id = randomUUID();
    const row: IdempotencyRow = {
      id,
      status: 'IN_PROGRESS',
      claimToken,
      version: 1,
      resultJson: null,
      requestHash: requestHash ?? null,
      claimedAt: new Date(),
      expiresAt,
      tenantId: identity.tenantId,
      organizationId: identity.organizationId,
      scope: identity.scope,
      key: identity.key,
    };
    this.rows.push(row);
    return { id, version: 1 };
  }

  async takeover(
    identity: IdempotencyIdentity,
    claimToken: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const row = this.rows.find(
      (r) =>
        r.tenantId === identity.tenantId &&
        r.organizationId === identity.organizationId &&
        r.scope === identity.scope &&
        r.key === identity.key &&
        (r.status === 'FAILED' || r.status === 'SUSPENDED' || r.expiresAt < new Date()),
    );
    if (!row) return false;
    row.status = 'IN_PROGRESS';
    row.claimToken = claimToken;
    row.resultJson = null;
    row.expiresAt = expiresAt;
    row.claimedAt = new Date();
    row.version += 1;
    return true;
  }

  async complete(
    id: string,
    claimToken: string,
    version: number,
    result: unknown,
  ): Promise<boolean> {
    const row = this.rows.find(
      (r) =>
        r.id === id &&
        r.claimToken === claimToken &&
        r.version === version &&
        r.status === 'IN_PROGRESS',
    );
    if (!row) return false;
    row.status = 'COMPLETED';
    row.resultJson = result;
    row.version += 1;
    return true;
  }

  async fail(
    id: string,
    claimToken: string,
    version: number,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<boolean> {
    const row = this.rows.find(
      (r) =>
        r.id === id &&
        r.claimToken === claimToken &&
        r.version === version &&
        r.status === 'IN_PROGRESS',
    );
    if (!row) return false;
    row.status = 'FAILED';
    row.version += 1;
    return true;
  }

  async suspendExpiredClaims(claimLeaseMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - claimLeaseMs);
    let count = 0;
    for (const row of this.rows) {
      if (row.status === 'IN_PROGRESS' && row.claimedAt && row.claimedAt < cutoff) {
        row.status = 'SUSPENDED';
        row.version += 1;
        count++;
      }
    }
    return count;
  }

  async purgeExpired(): Promise<number> {
    const now = new Date();
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.expiresAt >= now);
    return before - this.rows.length;
  }
}
