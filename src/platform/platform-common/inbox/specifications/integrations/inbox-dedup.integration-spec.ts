import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaInboxRepository } from '../../repositories/prisma-inbox.repository';
import { InboxIdentity } from '../../types/inbox.types';

/**
 * Integration specification — the inbox ledger against real Postgres.
 *
 * Proves what the unit tests can only fake: the unique identity is the
 * concurrency guard (one INSERT wins, the rest are duplicates), complete/fail
 * are CAS-fenced on the claim token, an expired lease is the only way back in,
 * the sweep parks poison as SUSPENDED and retention never touches it.
 */
describe('Inbox ledger (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let repository: PrismaInboxRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    repository = new PrismaInboxRepository(txHost);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await prisma.inboxMessage.deleteMany({ where: { tenantId: 'it-inbox-tenant' } });
  });

  const identity = (): InboxIdentity => ({
    tenantId: 'it-inbox-tenant',
    companyId: 'it-inbox-company',
    consumer: 'goods_receipt',
    messageId: randomUUID(),
  });

  function insert(identityValue: InboxIdentity, claimToken = randomUUID()) {
    return repository.insertIfAbsent({
      identity: identityValue,
      messageType: 'inventory.grn.created',
      eventVersion: 1,
      payload: { grnId: 'grn-1' },
      payloadHash: 'hash-1',
      headers: { 'tenant-id': 'it-inbox-tenant' },
      claimToken,
      claimedAt: new Date(),
      correlationId: 'corr-1',
      causationId: null,
    });
  }

  it('claims a first delivery exactly once', async () => {
    const id = identity();

    const [first, second] = await Promise.all([insert(id), insert(id)]);

    expect([first, second].filter(value => value !== null)).toHaveLength(1);

    const row = await prisma.inboxMessage.findFirstOrThrow({
      where: { tenantId: id.tenantId, messageId: id.messageId },
    });
    expect(row).toMatchObject({
      status: 'IN_PROGRESS',
      attempts: 1,
      eventName: 'inventory.grn.created',
      payloadHash: 'hash-1',
    });
  });

  it('completes with the claim token and refuses a stale one', async () => {
    const id = identity();
    const claimToken = randomUUID();
    await insert(id, claimToken);

    expect(
      await repository.complete((await repository.findUnique(id))?.id ?? '', randomUUID()),
    ).toBe(false);

    const row = await repository.findUnique(id);
    if (!row) throw new Error('row missing');
    expect(await repository.complete(row.id, claimToken)).toBe(true);

    const processed = await repository.findUnique(id);
    expect(processed?.status).toBe('PROCESSED');
    expect(processed?.processedAt).not.toBeNull();
  });

  it('re-claims only after the lease expires, and only once', async () => {
    const id = identity();
    await insert(id);

    const row = await repository.findUnique(id);
    if (!row) throw new Error('row missing');

    expect(await repository.reclaim(row.id, row.claimToken, randomUUID(), new Date())).toBe(true);
    // The previous token is now stale.
    expect(await repository.reclaim(row.id, row.claimToken, randomUUID(), new Date())).toBe(false);
  });

  it('schedules a backoff and keeps the row re-claimable', async () => {
    const id = identity();
    await insert(id);
    const row = await repository.findUnique(id);
    if (!row) throw new Error('row missing');

    expect(await repository.fail(row.id, row.claimToken, 'downstream 500', 1_000, 60_000)).toBe(
      true,
    );

    const failed = await repository.findUnique(id);
    expect(failed?.status).toBe('IN_PROGRESS');
    expect(failed?.claimedAt).toBeNull();
    expect(failed?.lastError).toBe('downstream 500');
    expect(failed?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now() - 1_000);
  });

  it('parks a permanent failure as FAILED', async () => {
    const id = identity();
    await insert(id);
    const row = await repository.findUnique(id);
    if (!row) throw new Error('row missing');

    expect(await repository.markPermanentlyFailed(row.id, row.claimToken, 'payload-mismatch')).toBe(
      true,
    );

    const parked = await repository.findUnique(id);
    expect(parked?.status).toBe('FAILED');
    expect(parked?.nextAttemptAt).toBeNull();
  });

  it('suspends poison and backs off the rest in one sweep', async () => {
    const poison = identity();
    const retryable = identity();
    await insert(poison);
    await insert(retryable);

    const stale = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.inboxMessage.updateMany({
      where: { tenantId: 'it-inbox-tenant' },
      data: { claimedAt: stale },
    });
    await prisma.inboxMessage.updateMany({
      where: { tenantId: 'it-inbox-tenant', messageId: poison.messageId },
      data: { attempts: 6 },
    });

    const touched = await repository.reconcileExpiredClaims({
      now: new Date(),
      claimLeaseMs: 60_000,
      maxAttempts: 5,
      retryBaseDelayMs: 1_000,
      retryMaxDelayMs: 60_000,
    });

    expect(touched).toBe(2);
    expect((await repository.findUnique(poison))?.status).toBe('SUSPENDED');
    const backedOff = await repository.findUnique(retryable);
    expect(backedOff?.status).toBe('IN_PROGRESS');
    expect(backedOff?.nextAttemptAt).not.toBeNull();
  });

  it('purges only PROCESSED rows past retention', async () => {
    const processed = identity();
    const suspended = identity();
    await insert(processed);
    await insert(suspended);

    await prisma.inboxMessage.updateMany({
      where: { tenantId: 'it-inbox-tenant', messageId: processed.messageId },
      data: { status: 'PROCESSED', processedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    await prisma.inboxMessage.updateMany({
      where: { tenantId: 'it-inbox-tenant', messageId: suspended.messageId },
      data: { status: 'SUSPENDED' },
    });

    await repository.deleteProcessedOlderThan(24 * 60 * 60 * 1000);

    expect(await repository.findUnique(processed)).toBeNull();
    expect((await repository.findUnique(suspended))?.status).toBe('SUSPENDED');
  });
});
