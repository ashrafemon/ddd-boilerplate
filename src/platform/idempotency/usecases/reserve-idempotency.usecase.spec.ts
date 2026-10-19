import { ReserveIdempotencyUseCase } from './reserve-idempotency.usecase';
import { PrismaIdempotencyRepository } from '../repositories/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from '../adapters/redis-idempotency-cache.adapter';
import { ConfigService } from '@config/config.service';
import { IIdempotencyConfig } from '../idempotency.types';

const config = {
  ttlMs: 86_400_000,
  claimLeaseMs: 300_000,
  reconciliationIntervalMs: 3_600_000,
  redisPrefix: 'idempotency',
} satisfies IIdempotencyConfig;

const configService = {
  getIdempotency: () => config,
} as unknown as ConfigService;

type RepoMock = {
  insertClaim: jest.Mock;
  findByIdentity: jest.Mock;
  takeoverExpiredClaim: jest.Mock;
};

const repo = (overrides: Partial<RepoMock> = {}): RepoMock => ({
  insertClaim: jest.fn().mockResolvedValue({ id: 'row-1', version: 1 }),
  findByIdentity: jest.fn().mockResolvedValue(null),
  takeoverExpiredClaim: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const cache = (): jest.Mocked<Pick<RedisIdempotencyCacheAdapter, 'buildKey' | 'get' | 'set'>> => ({
  buildKey: jest.fn().mockReturnValue('idempotency:t1:o1:test:k1'),
  get: jest.fn().mockResolvedValue({ hit: false }),
  set: jest.fn().mockResolvedValue(undefined),
});

const baseRequest = {
  tenantId: 't1',
  organizationId: 'o1',
  scope: 'test',
  key: 'k1',
  requestHash: 'hash-1',
};

const makeUseCase = (
  repository: RepoMock,
  cacheAdapter: ReturnType<typeof cache>,
): ReserveIdempotencyUseCase =>
  new ReserveIdempotencyUseCase(
    repository as unknown as PrismaIdempotencyRepository,
    cacheAdapter as unknown as RedisIdempotencyCacheAdapter,
    configService,
  );

describe('ReserveIdempotencyUseCase', () => {
  it('inserts a new claim and returns ACQUIRED with identity in the reservation', async () => {
    const repository = repo();
    const result = await makeUseCase(repository, cache()).execute(baseRequest);

    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation).toMatchObject({
        id: 'row-1',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        claimToken: expect.any(String),
        version: 1,
        tenantId: 't1',
        organizationId: 'o1',
        scope: 'test',
        key: 'k1',
      });
    }
  });

  it('returns REPLAY from the Redis result cache without touching Postgres', async () => {
    const repository = repo();
    const cacheAdapter = cache();
    cacheAdapter.get.mockResolvedValue({ hit: true, value: { id: 'o-1' } });

    const result = await makeUseCase(repository, cacheAdapter).execute(baseRequest);

    expect(result).toEqual({ status: 'REPLAY', result: { id: 'o-1' } });
    expect(repository.insertClaim).not.toHaveBeenCalled();
  });

  it('returns REPLAY for a COMPLETED row with the same hash and re-warms Redis', async () => {
    const repository = repo({
      insertClaim: jest.fn().mockRejectedValue(new Error('unique')),
      findByIdentity: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'COMPLETED',
        claimToken: 'tok',
        version: 2,
        resultJson: { id: 'o-1' },
        requestHash: 'hash-1',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });
    const cacheAdapter = cache();

    const result = await makeUseCase(repository, cacheAdapter).execute(baseRequest);

    expect(result).toEqual({ status: 'REPLAY', result: { id: 'o-1' } });
    expect(cacheAdapter.set).toHaveBeenCalledWith(
      'idempotency:t1:o1:test:k1',
      { id: 'o-1' },
      expect.any(Number),
    );
  });

  it('returns KEY_MISMATCH when the same key carries a different hash', async () => {
    const repository = repo({
      insertClaim: jest.fn().mockRejectedValue(new Error('unique')),
      findByIdentity: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'COMPLETED',
        claimToken: 'tok',
        version: 2,
        resultJson: { id: 'o-1' },
        requestHash: 'other-hash',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    const result = await makeUseCase(repository, cache()).execute(baseRequest);

    expect(result).toEqual({ status: 'KEY_MISMATCH' });
  });

  it('returns BUSY while an IN_PROGRESS claim lease is live', async () => {
    const repository = repo({
      insertClaim: jest.fn().mockRejectedValue(new Error('unique')),
      findByIdentity: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'IN_PROGRESS',
        claimToken: 'tok',
        version: 1,
        resultJson: null,
        requestHash: 'hash-1',
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    });

    const result = await makeUseCase(repository, cache()).execute(baseRequest);

    expect(result).toEqual({ status: 'BUSY' });
    expect(repository.takeoverExpiredClaim).toHaveBeenCalled();
  });

  it('takes over an expired IN_PROGRESS claim and returns ACQUIRED', async () => {
    const repository = repo({
      insertClaim: jest.fn().mockRejectedValue(new Error('unique')),
      findByIdentity: jest.fn().mockResolvedValue({
        id: 'row-1',
        status: 'IN_PROGRESS',
        claimToken: 'old-token',
        version: 3,
        resultJson: null,
        requestHash: 'hash-1',
        claimedAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      takeoverExpiredClaim: jest.fn().mockResolvedValue({ id: 'row-1', version: 4 }),
    });

    const result = await makeUseCase(repository, cache()).execute(baseRequest);

    expect(result.status).toBe('ACQUIRED');
    if (result.status === 'ACQUIRED') {
      expect(result.reservation.version).toBe(4);
    }
  });
});
