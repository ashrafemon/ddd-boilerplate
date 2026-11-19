import { ConfigService } from '@config/config.service';
import { RedisIdempotencyCacheAdapter } from '../adapters/redis-idempotency-cache.adapter';
import { PrismaIdempotencyRepository } from '../repositories/prisma-idempotency.repository';
import {
  IdempotencyIdentity,
  IdempotencyReserveRequest,
  IdempotencyRowView,
} from '../types/idempotency.types';
import { ReserveIdempotencyUseCase } from './reserve-idempotency.usecase';

const IDENTITY: IdempotencyIdentity = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  scope: 'purchase-order:create',
  key: 'key-1',
};

const REQUEST: IdempotencyReserveRequest = { ...IDENTITY, requestHash: 'hash-a' };

const LIVE_LEASE_MS = 30_000;

interface RepositoryFake {
  findByIdentity: jest.Mock;
  insertClaim: jest.Mock;
  takeoverExpiredClaim: jest.Mock;
}

interface CacheFake {
  buildKey: (identity: IdempotencyIdentity) => string;
  get: jest.Mock;
  set: jest.Mock;
}

function row(overrides: Partial<IdempotencyRowView> = {}): IdempotencyRowView {
  return {
    id: 'row-1',
    status: 'IN_PROGRESS',
    claimToken: 'old-token',
    version: 1,
    resultJson: null,
    requestHash: 'hash-a',
    claimedAt: new Date(),
    leaseUntil: new Date(),
    lastError: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function build(): {
  useCase: ReserveIdempotencyUseCase;
  repository: RepositoryFake;
  cache: CacheFake;
} {
  const repository: RepositoryFake = {
    findByIdentity: jest.fn().mockResolvedValue(null),
    insertClaim: jest.fn().mockResolvedValue({ id: 'row-1', version: 1 }),
    takeoverExpiredClaim: jest.fn().mockResolvedValue(null),
  };
  const cache: CacheFake = {
    buildKey: (identity: IdempotencyIdentity) => `idem:${identity.key}`,
    get: jest.fn().mockResolvedValue({ hit: false }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const configService = {
    getIdempotency: () => ({
      ttlMs: 86_400_000,
      claimLeaseMs: LIVE_LEASE_MS,
      reconciliationIntervalMs: 3_600_000,
      redisPrefix: 'idem',
    }),
  } as unknown as ConfigService;

  const useCase = new ReserveIdempotencyUseCase(
    repository as unknown as PrismaIdempotencyRepository,
    cache as unknown as RedisIdempotencyCacheAdapter,
    configService,
  );
  return { useCase, repository, cache };
}

describe('ReserveIdempotencyUseCase', () => {
  it('replays a cached result without touching Postgres', async () => {
    const { useCase, repository, cache } = build();
    cache.get.mockResolvedValue({ hit: true, value: { id: 'po-1' } });

    const result = await useCase.execute(REQUEST);

    expect(result).toEqual({ status: 'REPLAY', result: { id: 'po-1' } });
    expect(repository.insertClaim).not.toHaveBeenCalled();
    expect(repository.findByIdentity).not.toHaveBeenCalled();
    expect(cache.buildKey).toBeDefined();
  });

  it('acquires the claim and stamps a lease that outlives the request', async () => {
    const { useCase, repository } = build();
    const before = Date.now();

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    const [identity, token, expiresAt, leaseUntil, hash] = repository.insertClaim.mock.calls[0] as [
      IdempotencyIdentity,
      string,
      Date,
      Date,
      string,
    ];
    expect(identity).toEqual(IDENTITY);
    expect(typeof token).toBe('string');
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 86_400_000);
    expect(leaseUntil.getTime()).toBeGreaterThanOrEqual(before + LIVE_LEASE_MS);
    expect(hash).toBe('hash-a');
  });

  it('replays a COMPLETED row and warms the cache with the remaining TTL', async () => {
    const { useCase, repository, cache } = build();
    repository.insertClaim.mockRejectedValue(new Error('unique violation'));
    repository.findByIdentity.mockResolvedValue(
      row({ status: 'COMPLETED', resultJson: { id: 'po-1' } }),
    );

    const result = await useCase.execute(REQUEST);

    expect(result).toEqual({ status: 'REPLAY', result: { id: 'po-1' } });
    expect(cache.set).toHaveBeenCalledWith('idem:key-1', { id: 'po-1' }, expect.any(Number));
  });

  it('rejects a reused key carrying a different payload', async () => {
    const { useCase, repository } = build();
    repository.insertClaim.mockRejectedValue(new Error('unique violation'));
    repository.findByIdentity.mockResolvedValue(row({ requestHash: 'hash-b' }));

    expect(await useCase.execute(REQUEST)).toEqual({ status: 'KEY_MISMATCH' });
    expect(repository.takeoverExpiredClaim).not.toHaveBeenCalled();
  });

  it('takes over a claim whose lease expired', async () => {
    const { useCase, repository } = build();
    repository.insertClaim.mockRejectedValue(new Error('unique violation'));
    repository.findByIdentity.mockResolvedValue(row());
    repository.takeoverExpiredClaim.mockResolvedValue({ id: 'row-1', version: 2 });

    const result = await useCase.execute(REQUEST);

    expect(result.status).toBe('ACQUIRED');
    const [, , expiresAt, leaseUntil, legacyCutoff] = repository.takeoverExpiredClaim.mock
      .calls[0] as [unknown, string, Date, Date, Date];
    expect(expiresAt.getTime()).toBeGreaterThan(leaseUntil.getTime());
    expect(legacyCutoff.getTime()).toBeLessThan(Date.now());
  });

  it('reports BUSY while the existing claim lease is still live', async () => {
    const { useCase, repository } = build();
    repository.insertClaim.mockRejectedValue(new Error('unique violation'));
    repository.findByIdentity.mockResolvedValue(row());
    repository.takeoverExpiredClaim.mockResolvedValue(null);

    expect(await useCase.execute(REQUEST)).toEqual({ status: 'BUSY' });
  });
});
