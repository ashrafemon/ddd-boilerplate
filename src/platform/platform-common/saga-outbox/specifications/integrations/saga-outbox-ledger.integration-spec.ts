import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaOutboxRepository } from '@platform/platform-common/outbox/outbound/adapters/prisma-outbox.repository';
import { AppendOutboxEventRequest } from '@platform/platform-common/outbox/types/outbox.types';
import { PrismaSagaOutboxRepository } from '../../outbound/adapters/prisma-saga-outbox.repository';

/**
 * Integration specification — `saga_outbox` against real Postgres.
 *
 * The point of the dedicated ledger is isolation, so the assertions are about
 * separation: an appended saga event lands in `saga_outbox` (never in
 * `outbox_messages`), and the two ledgers never claim each other's rows while
 * sharing one claim/CAS implementation.
 */
describe('Saga outbox ledger (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let repository: PrismaSagaOutboxRepository;
  let sharedOutbox: PrismaOutboxRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    repository = new PrismaSagaOutboxRepository(txHost);
    sharedOutbox = new PrismaOutboxRepository(txHost);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    await prisma.sagaOutboxMessage.deleteMany({ where: { tenantId: 'it-saga-tenant' } });
    await prisma.outboxMessage.deleteMany({ where: { tenantId: 'it-saga-tenant' } });
  });

  function appendRequest(
    overrides: Partial<AppendOutboxEventRequest> = {},
  ): AppendOutboxEventRequest {
    return {
      tenantId: 'it-saga-tenant',
      companyId: 'it-saga-company',
      eventId: randomUUID(),
      eventType: 'SagaEmittedEvent',
      eventVersion: 1,
      aggregateType: 'Saga',
      aggregateId: randomUUID(),
      payload: { sagaKey: 'goods_receipt' },
      headers: { broker: 'rabbitmq' },
      ...overrides,
    };
  }

  const claimOptions = { batchSize: 10, maxAttempts: 10, claimLeaseMs: 60_000 };

  it('appends to saga_outbox and leaves the shared outbox untouched', async () => {
    const message = await repository.append(appendRequest());

    expect(message).toMatchObject({ status: 'PENDING', attempts: 0, claimToken: null });

    const sagaRow = await prisma.sagaOutboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(sagaRow).toMatchObject({ tenantId: 'it-saga-tenant', status: 'PENDING' });

    const sharedRows = await prisma.outboxMessage.count({
      where: { tenantId: 'it-saga-tenant' },
    });
    expect(sharedRows).toBe(0);
  });

  it('claims and settles a saga event without crossing into the shared ledger', async () => {
    const message = await repository.append(appendRequest());

    const claimed = await repository.claimBatch(claimOptions);
    const record = claimed.find(c => c.id === message.id);
    if (!record) throw new Error('saga row not claimed');
    expect(record.attempts).toBe(1);
    expect(record.status).toBe('PUBLISHING');

    // The shared dispatcher must not see the saga's traffic.
    const sharedClaim = await sharedOutbox.claimBatch(claimOptions);
    expect(sharedClaim.map(r => r.id)).not.toContain(message.id);

    await repository.markPublished(record.id, record.claimToken);

    const row = await prisma.sagaOutboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row).toMatchObject({ status: 'PUBLISHED', claimToken: null, claimedAt: null });
    expect(row.publishedAt).not.toBeNull();
  });

  it('keeps a saga event out of the shared ledger on the way in as well', async () => {
    const sharedMessage = await sharedOutbox.append(appendRequest());

    const sagaClaim = await repository.claimBatch(claimOptions);
    expect(sagaClaim.map(r => r.id)).not.toContain(sharedMessage.id);

    const sharedRow = await prisma.outboxMessage.findUniqueOrThrow({
      where: { id: sharedMessage.id },
    });
    expect(sharedRow.status).toBe('PENDING');
  });

  it('parks an exhausted saga event as DEAD_LETTER instead of deleting it', async () => {
    const message = await repository.append(appendRequest());
    const [claim] = await repository.claimBatch(claimOptions);
    if (!claim) throw new Error('saga row not claimed');

    await prisma.sagaOutboxMessage.update({
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

    const row = await prisma.sagaOutboxMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(row.status).toBe('DEAD_LETTER');
  });
});
