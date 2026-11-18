import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { IdempotencyAdapter } from '../../inbound/adapters/idempotency.adapter';
import { IdempotencyPort } from '../../inbound/ports/idempotency.port';
import { PrismaIdempotencyRepository } from '../../outbound/adapters/prisma-idempotency.repository';
import { RedisIdempotencyCacheAdapter } from '../../outbound/adapters/redis-idempotency-cache.adapter';
import { IdempotencyReplayCachePort } from '../../outbound/ports/idempotency-replay-cache.port';
import { IdempotencyRepositoryPort } from '../../outbound/ports/idempotency.repository.port';
import { IdempotencyIdentity } from '../../types/idempotency.types';
import { CompleteIdempotencyUseCase } from '../../use-cases/complete-idempotency.usecase';
import { FailIdempotencyUseCase } from '../../use-cases/fail-idempotency.usecase';
import { ReserveIdempotencyUseCase } from '../../use-cases/reserve-idempotency.usecase';

/**
 * Integration specification — the claim ledger against real Postgres + Redis.
 *
 * Proves the invariants the unit tests can only fake: the unique identity is
 * the concurrency guard, a completed result replays from Redis after the row is
 * gone, an expired `lease_until` is the only way to take a claim over, the
 * previous owner can never commit, and fail() frees the key immediately.
 */

const TENANT = 'it-tenant';
const COMPANY = 'it-company';

describe('Idempotency claim ledger (integration)', () => {
  let moduleRef: TestingModule;
  let port: IdempotencyPort;
  let prisma: PrismaWriteService;

  beforeAll(async () => {
    // Only the idempotency graph plus its two clients. Importing
    // IdempotencyModule would drag in ContextModule → InfrastructureModule and
    // make init() probe every broker this test does not need.
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, RedisModule],
      providers: [
        PrismaIdempotencyRepository,
        { provide: IdempotencyRepositoryPort, useExisting: PrismaIdempotencyRepository },
        RedisIdempotencyCacheAdapter,
        { provide: IdempotencyReplayCachePort, useExisting: RedisIdempotencyCacheAdapter },
        ReserveIdempotencyUseCase,
        CompleteIdempotencyUseCase,
        FailIdempotencyUseCase,
        IdempotencyAdapter,
        { provide: IdempotencyPort, useExisting: IdempotencyAdapter },
      ],
    }).compile();
    // init() so close() runs the Prisma/Redis destroy hooks (no leaked pools).
    await moduleRef.init();
    port = moduleRef.get(IdempotencyPort);
    prisma = moduleRef.get(PrismaWriteService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await prisma.idempotencyKey.deleteMany({
      where: { tenantId: TENANT, companyId: COMPANY },
    });
  });

  const identity = (): IdempotencyIdentity => ({
    tenantId: TENANT,
    companyId: COMPANY,
    scope: `it-${randomUUID()}`,
    key: randomUUID(),
  });

  it('replays a completed result from Redis even after the row is gone', async () => {
    const id = identity();

    const reserved = await port.reserve(id);
    if (reserved.status !== 'ACQUIRED') throw new Error('expected ACQUIRED');
    await port.complete({ reservation: reserved.reservation, result: { ok: true } });

    await prisma.idempotencyKey.deleteMany({ where: { id: reserved.reservation.id } });

    expect(await port.reserve(id)).toEqual({ status: 'REPLAY', result: { ok: true } });
  });

  it('lets exactly one of two concurrent reserves win', async () => {
    const id = identity();

    const [first, second] = await Promise.all([port.reserve(id), port.reserve(id)]);
    const statuses = [first.status, second.status].sort();

    expect(statuses).toEqual(['ACQUIRED', 'BUSY']);
  });

  it('takes over only after the lease expires and fences the previous owner', async () => {
    const id = identity();

    const first = await port.reserve(id);
    if (first.status !== 'ACQUIRED') throw new Error('expected ACQUIRED');

    // Still live: a second reserve must not steal it.
    expect(await port.reserve(id)).toEqual({ status: 'BUSY' });

    await prisma.idempotencyKey.updateMany({
      where: { id: first.reservation.id },
      data: { leaseUntil: new Date(Date.now() - 1_000) },
    });

    const second = await port.reserve(id);
    if (second.status !== 'ACQUIRED') throw new Error('expected takeover ACQUIRED');

    const row = await prisma.idempotencyKey.findUniqueOrThrow({
      where: { id: first.reservation.id },
    });
    expect(row.version).toBe(2);
    expect(row.claimToken).toBe(second.reservation.claimToken);
    expect(row.claimToken).not.toBe(first.reservation.claimToken);
    expect(row.lastError).toContain('lease expired');

    // The fenced owner cannot commit: its CAS no longer matches.
    await port.complete({ reservation: first.reservation, result: { stale: true } });

    const after = await prisma.idempotencyKey.findUniqueOrThrow({
      where: { id: first.reservation.id },
    });
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.resultJson).toBeNull();
  });

  it('releases the key immediately on fail so a retry starts clean', async () => {
    const id = identity();

    const reserved = await port.reserve(id);
    if (reserved.status !== 'ACQUIRED') throw new Error('expected ACQUIRED');

    await port.fail({ reservation: reserved.reservation });

    expect(await prisma.idempotencyKey.count({ where: { key: id.key } })).toBe(0);
    expect((await port.reserve(id)).status).toBe('ACQUIRED');
  });
});
