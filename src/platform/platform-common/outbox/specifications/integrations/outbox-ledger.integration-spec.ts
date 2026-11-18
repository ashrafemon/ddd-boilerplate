import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaOutboxRepository } from '../../outbound/adapters/prisma-outbox.repository';
import { AppendOutboxEventRequest } from '../../types/outbox.types';

/**
 * Integration specification — the outbox ledger against real Postgres.
 *
 * Proves the claim/settle invariants the unit tests can only fake: a claim is a
 * lease (status PUBLISHING, attempts increments), a settled row is never
 * re-claimed, an abandoned lease is reclaimed by the next tick without any
 * reconciler, backoff keeps a failing row out of the next claim, and exhausted
 * rows park DEAD_LETTER instead of disappearing.
 *
 * The repository receives a `TransactionHost` shim over the real client so the
 * SQL runs outside a CLS transaction, which is exactly how the scheduler ticks.
 */
describe('Outbox ledger (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let repository: PrismaOutboxRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    repository = new PrismaOutboxRepository(txHost);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await prisma.outboxMessage.deleteMany({ where: { tenantId: 'it-outbox-tenant' } });
  });

  function appendRequest(
    overrides: Partial<AppendOutboxEventRequest> = {},
  ): AppendOutboxEventRequest {
    return {
      tenantId: 'it-outbox-tenant',
      companyId: 'it-outbox-company',
      eventId: randomUUID(),
      eventType: 'OrderCreated',
      eventVersion: 1,
      aggregateType: 'PurchaseOrder',
      aggregateId: randomUUID(),
      payload: { orderId: 'order-1' },
      headers: { broker: 'rabbitmq' },
      ...overrides,
    };
  }

  it('appends a PENDING row with no attempts and no claim', async () => {
    const message = await repository.append(appendRequest());

    expect(message).toMatchObject({
      status: 'PENDING',
      attempts: 0,
      claimToken: null,
      publishedAt: null,
      tenantId: 'it-outbox-tenant',
      companyId: 'it-outbox-company',
    });
  });

  it('claims a due row, then settles it PUBLISHED', async () => {
    const message = await repository.append(appendRequest());

    const claimed = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });

    expect(claimed.map(c => c.id)).toContain(message.id);
    const record = claimed.find(c => c.id === message.id);
    if (!record) throw new Error('row not claimed');
    expect(record.attempts).toBe(1);
    expect(record.status).toBe('PUBLISHING');

    await repository.markPublished(record.id, record.claimToken);

    const rows = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(rows.map(r => r.id)).not.toContain(message.id);

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row).toMatchObject({ status: 'PUBLISHED', claimToken: null, claimedAt: null });
    expect(row.publishedAt).not.toBeNull();
  });

  it('reclaims a row whose owner crashed once the lease expires', async () => {
    const message = await repository.append(appendRequest());
    const first = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    const firstClaim = first.find(c => c.id === message.id);
    if (!firstClaim) throw new Error('row not claimed');

    // A live lease keeps the row out of the next tick.
    const blocked = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(blocked.map(r => r.id)).not.toContain(message.id);

    await prisma.outboxMessage.update({
      where: { id: message.id },
      data: { claimedAt: new Date(Date.now() - 120_000) },
    });

    const reclaimed = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    const second = reclaimed.find(c => c.id === message.id);
    if (!second) throw new Error('row not reclaimed');
    expect(second.attempts).toBe(2);
    expect(second.claimToken).not.toBe(firstClaim.claimToken);

    // The crashed owner's token can no longer settle the row: it stays with the
    // current claim instead of flipping to PUBLISHED.
    await repository.markPublished(message.id, firstClaim.claimToken);
    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.status).toBe('PUBLISHING');
    expect(row.claimToken).toBe(second.claimToken);
  });

  it('keeps a failing row PENDING until its backoff elapses', async () => {
    const message = await repository.append(appendRequest());
    const [claim] = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });

    await repository.markFailed(
      claim.id,
      claim.claimToken,
      'broker down',
      new Date(Date.now() + 60_000),
      10,
    );

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row).toMatchObject({ status: 'PENDING', claimToken: null, lastError: 'broker down' });

    const next = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(next.map(r => r.id)).not.toContain(message.id);
  });

  it('parks an exhausted row as DEAD_LETTER instead of deleting it', async () => {
    const message = await repository.append(appendRequest());
    const [claim] = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    await prisma.outboxMessage.update({
      where: { id: message.id },
      data: { attempts: 11 },
    });

    await repository.markFailed(
      claim.id,
      claim.claimToken,
      'poison',
      new Date(Date.now() + 1_000),
      10,
    );

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.status).toBe('DEAD_LETTER');
  });

  it('parks a permanently failing row as FAILED and never claims it again', async () => {
    const message = await repository.append(appendRequest());
    const [claim] = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });

    await repository.markPermanentlyFailed(claim.id, claim.claimToken, 'KAFKA_BROKERS missing');

    const row = await prisma.outboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row).toMatchObject({
      status: 'FAILED',
      claimToken: null,
      lastError: 'KAFKA_BROKERS missing',
    });

    const next = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 0,
    });
    expect(next.map(r => r.id)).not.toContain(message.id);
  });

  it('respects available_at as the backoff boundary', async () => {
    const message = await repository.append(
      appendRequest({ availableAt: new Date(Date.now() + 60_000) }),
    );

    const early = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(early.map(r => r.id)).not.toContain(message.id);

    await prisma.outboxMessage.update({
      where: { id: message.id },
      data: { availableAt: new Date(Date.now() - 1_000) },
    });

    const due = await repository.claimBatch({
      batchSize: 10,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(due.map(r => r.id)).toContain(message.id);
  });

  it('deletes only PUBLISHED rows past the retention window', async () => {
    const published = await repository.append(appendRequest());
    const pending = await repository.append(appendRequest());
    await prisma.outboxMessage.update({
      where: { id: published.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const deleted = await repository.deletePublishedOlderThan(24);

    expect(deleted).toBeGreaterThanOrEqual(1);
    const gone = await prisma.outboxMessage.findUnique({ where: { id: published.id } });
    const kept = await prisma.outboxMessage.findUnique({ where: { id: pending.id } });
    expect(gone).toBeNull();
    expect(kept).not.toBeNull();
  });
});
