import fc from 'fast-check';
import { ConfigService } from '@config/config.service';
import { IdempotencyReplayCachePort } from '../../outbound/ports/idempotency-replay-cache.port';
import { IdempotencyRepositoryPort } from '../../outbound/ports/idempotency.repository.port';
import { IdempotencyIdentity, IdempotencyRowView } from '../../types/idempotency.types';
import { ReserveIdempotencyUseCase } from '../../use-cases/reserve-idempotency.usecase';

/**
 * Property specification — payload-hash arbitration.
 *
 * A COMPLETED row means the operation already ran. From then on the only
 * correct answers are:
 *   same hash  → REPLAY (hand back the stored result, run nothing)
 *   other hash → KEY_MISMATCH (the key now belongs to a different request)
 *
 * Enumerating a handful of hashes would not catch a comparison that only
 * inspects a prefix, ignores case, or short-circuits on an empty value, so the
 * property runs over arbitrary strings.
 */

const IDENTITY: IdempotencyIdentity = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  scope: 'property-spec',
  key: 'key-1',
};

const row = (requestHash: string): IdempotencyRowView => ({
  id: 'row-1',
  status: 'COMPLETED',
  claimToken: 'claim-1',
  version: 2,
  resultJson: { ok: true },
  requestHash,
  claimedAt: new Date(),
  leaseUntil: null,
  lastError: null,
  expiresAt: new Date(Date.now() + 60_000),
});

function useCaseFor(storedHash: string): ReserveIdempotencyUseCase {
  const repository = {
    insertClaim: jest.fn().mockRejectedValue(new Error('unique violation')),
    findByIdentity: jest.fn().mockResolvedValue(row(storedHash)),
    takeoverExpiredClaim: jest.fn().mockResolvedValue(null),
  };
  const cache = {
    buildKey: () => 'idem:key-1',
    get: jest.fn().mockResolvedValue({ hit: false }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    getIdempotency: () => ({
      ttlMs: 60_000,
      claimLeaseMs: 30_000,
      reconciliationIntervalMs: 3_600_000,
      redisPrefix: 'idem',
    }),
  } as unknown as ConfigService;

  return new ReserveIdempotencyUseCase(
    repository as unknown as IdempotencyRepositoryPort,
    cache as unknown as IdempotencyReplayCachePort,
    configService,
  );
}

const hash = fc.string({ minLength: 1, maxLength: 64 });

describe('idempotency payload hash (property)', () => {
  it('replays on an identical hash and rejects any other', async () => {
    await fc.assert(
      fc.asyncProperty(hash, hash, async (storedHash, incomingHash) => {
        const result = await useCaseFor(storedHash).execute({
          ...IDENTITY,
          requestHash: incomingHash,
        });
        return storedHash === incomingHash
          ? result.status === 'REPLAY'
          : result.status === 'KEY_MISMATCH';
      }),
      { numRuns: 200 },
    );
  });
});
