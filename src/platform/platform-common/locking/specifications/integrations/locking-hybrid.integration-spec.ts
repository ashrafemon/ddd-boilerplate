import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { LockAdapter } from '../../adapters/lock.adapter';
import { DistributedLockPort } from '../../ports/distributed-lock.port';
import { PrismaLockLedgerRepository } from '../../repositories/prisma-lock-ledger.repository';
import { RedisLockLeaseAdapter } from '../../adapters/redis-lock-lease.adapter';
import { AcquireDistributedLockUseCase } from '../../use-cases/acquire-distributed-lock.usecase';
import { RenewDistributedLockUseCase } from '../../use-cases/renew-distributed-lock.usecase';
import { ReleaseDistributedLockUseCase } from '../../use-cases/release-distributed-lock.usecase';
import { DistributedLockIdentity, DistributedLockTicket } from '../../types/locking.types';

/**
 * Integration specification — the hybrid lock against real Postgres + Redis.
 *
 * Proves the invariants the unit tests fake: exactly one winner, a strictly
 * increasing fencing token per identity, takeover only after the lease lapses,
 * a fenced-out owner that can neither renew nor release, and release freeing
 * both halves.
 */

const TENANT = 'it-lock-tenant';
const COMPANY = 'it-lock-company';

describe('Distributed lock (integration)', () => {
  let moduleRef: TestingModule;
  let lock: DistributedLockPort;
  let prisma: PrismaWriteService;
  let lease: RedisLockLeaseAdapter;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule, RedisModule],
      providers: [
        RedisLockLeaseAdapter,
        { provide: RedisLockLeaseAdapter, useExisting: RedisLockLeaseAdapter },
        PrismaLockLedgerRepository,
        { provide: PrismaLockLedgerRepository, useExisting: PrismaLockLedgerRepository },
        AcquireDistributedLockUseCase,
        RenewDistributedLockUseCase,
        ReleaseDistributedLockUseCase,
        LockAdapter,
        { provide: DistributedLockPort, useExisting: LockAdapter },
      ],
    }).compile();
    await moduleRef.init();

    lock = moduleRef.get(DistributedLockPort);
    lease = moduleRef.get(RedisLockLeaseAdapter);
    prisma = moduleRef.get(PrismaWriteService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const identity = (): DistributedLockIdentity => ({
    tenantId: TENANT,
    companyId: COMPANY,
    scope: 'it.lock',
    resource: randomUUID(),
  });

  afterEach(async () => {
    await prisma.distributedLock.deleteMany({
      where: { tenantId: TENANT, companyId: COMPANY },
    });
  });

  async function acquireOrFail(id: DistributedLockIdentity): Promise<DistributedLockTicket> {
    const result = await lock.acquire({ ...id, leaseMs: 5_000 });
    if (result.status !== 'ACQUIRED') throw new Error(`expected ACQUIRED, got ${result.status}`);
    return result.ticket;
  }

  it('lets exactly one of two concurrent acquires win', async () => {
    const id = identity();

    const [first, second] = await Promise.all([
      lock.acquire({ ...id, leaseMs: 5_000 }),
      lock.acquire({ ...id, leaseMs: 5_000 }),
    ]);

    expect([first.status, second.status].sort()).toEqual(['ACQUIRED', 'BUSY']);
  });

  it('gives every new owner a strictly higher fencing token', async () => {
    const id = identity();

    const first = await acquireOrFail(id);
    await lock.release({ ticket: first });

    const second = await acquireOrFail(id);
    await lock.release({ ticket: second });

    const third = await acquireOrFail(id);

    expect(second.fencingToken).toBeGreaterThan(first.fencingToken);
    expect(third.fencingToken).toBeGreaterThan(second.fencingToken);
  });

  it('takes over only after the lease lapses and fences the previous owner', async () => {
    const id = identity();
    const first = await acquireOrFail(id);

    // Live lease: the ledger keeps the row from being claimed.
    expect((await lock.acquire({ ...id, leaseMs: 5_000 })).status).toBe('BUSY');

    await prisma.distributedLock.updateMany({
      where: { tenantId: TENANT, companyId: COMPANY, resource: id.resource },
      data: { leaseUntil: new Date(Date.now() - 1_000) },
    });
    await lease.release(first.lockKey, first.ownerToken);

    const second = await acquireOrFail(id);
    expect(second.fencingToken).toBeGreaterThan(first.fencingToken);

    // The fenced-out owner can no longer extend or release.
    expect(await lock.renew({ ticket: first })).toEqual({ status: 'LOST' });
    await lock.release({ ticket: first });

    const row = await prisma.distributedLock.findFirstOrThrow({
      where: { tenantId: TENANT, companyId: COMPANY, resource: id.resource },
    });
    expect(row.ownerToken).toBe(second.ownerToken);
  });

  it('releases both halves so the next caller wins immediately', async () => {
    const id = identity();
    const ticket = await acquireOrFail(id);

    await lock.release({ ticket });
    expect(await lease.isHeld(ticket.lockKey)).toBe(false);

    const row = await prisma.distributedLock.findFirstOrThrow({
      where: { tenantId: TENANT, companyId: COMPANY, resource: id.resource },
    });
    expect(row.ownerToken).toBeNull();
    expect(row.leaseUntil).toBeNull();

    expect((await lock.acquire({ ...id, leaseMs: 5_000 })).status).toBe('ACQUIRED');
  });

  it('reports RENEWED and pushes the expiry out for the live owner', async () => {
    const id = identity();
    const ticket = await acquireOrFail(id);

    const renewed = await lock.renew({ ticket, leaseMs: 9_000 });
    if (renewed.status !== 'RENEWED') throw new Error('expected RENEWED');

    expect(renewed.ticket.expiresAt.getTime()).toBeGreaterThan(ticket.expiresAt.getTime());
    expect(renewed.ticket.fencingToken).toBe(ticket.fencingToken);
  });
});
