import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@infrastructure/prisma/prisma.module';
import { PrismaWriteService } from '@infrastructure/prisma/prisma-write.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaSagaDefinitionRepository } from '../../outbound/adapters/prisma-saga-definition.repository';
import { PrismaSagaInboxRepository } from '@platform/platform-common/saga-inbox/outbound/adapters/prisma-saga-inbox.repository';
import { PrismaSagaInstanceRepository } from '../../outbound/adapters/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../../outbound/adapters/prisma-saga-step.repository';
import {
  SagaDefinitionStatus,
  SagaInstanceStatus,
  SagaPlan,
  SagaStepKind,
  SagaStepStatus,
} from '../../types/saga.types';

/**
 * Integration specification — the saga runtime against real Postgres.
 *
 * The unit specs prove the decisions; this proves the fences they rely on:
 * one live instance per correlation key (and the release on a terminal state),
 * CAS versioning, SKIP LOCKED claims with a fairness cap, the retry requeue, the
 * WAIT timeout scan and the saga-inbox dedupe.
 */

const PLAN: SagaPlan = {
  sagaKey: 'grn-to-invoice',
  version: 1,
  steps: [
    {
      id: 'valuate',
      kind: SagaStepKind.DO,
      action: 'inventory.valuate',
      maxAttempts: 3,
      pivot: false,
    },
    {
      id: 'wait-bill',
      kind: SagaStepKind.WAIT,
      waitFor: { name: 'ap.bill.posted', version: 1 },
      maxAttempts: 3,
      pivot: false,
    },
  ],
  cancelOn: [],
};

describe('Saga runtime ledger (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaWriteService;
  let definitions: PrismaSagaDefinitionRepository;
  let instances: PrismaSagaInstanceRepository;
  let steps: PrismaSagaStepRepository;
  let inbox: PrismaSagaInboxRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();

    prisma = moduleRef.get(PrismaWriteService);
    const txHost = { tx: prisma } as unknown as TransactionHost<TransactionalAdapterPrisma>;
    definitions = new PrismaSagaDefinitionRepository(txHost);
    instances = new PrismaSagaInstanceRepository(txHost);
    steps = new PrismaSagaStepRepository(txHost);
    inbox = new PrismaSagaInboxRepository(txHost);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  afterEach(async () => {
    const where = { tenantId: 'it-saga-tenant' };
    await prisma.sagaInbox.deleteMany({ where });
    await prisma.sagaStep.deleteMany({ where });
    await prisma.sagaInstance.deleteMany({ where });
    await prisma.sagaDefinition.deleteMany({ where: { sagaKey: { startsWith: 'it-' } } });
  });

  async function createDefinition(): Promise<string> {
    const record = await definitions.create({
      sagaKey: `it-${randomUUID()}`,
      ownerModule: 'procurement',
      status: SagaDefinitionStatus.ACTIVE,
      definition: {
        key: 'it-saga',
        version: 1,
        start: { event: { name: 'inventory.grn.created', version: 1 }, key: 'GRN:{{event.grnId}}' },
        steps: [{ id: 'valuate', policy: 'required', do: 'inventory.valuate' }],
      },
    });
    return record.id;
  }

  function insertInstance(definitionId: string, correlationKey = 'GRN:grn-1') {
    return instances.tryInsertLive({
      tenantId: 'it-saga-tenant',
      companyId: 'it-saga-company',
      sagaKey: 'it-saga',
      definitionId,
      configId: null,
      rootRefType: null,
      rootRefId: null,
      correlationKey,
      plan: PLAN,
      context: {},
      deadlineAt: null,
    });
  }

  it('allows exactly one live instance per correlation key', async () => {
    const definitionId = await createDefinition();

    const [first, second] = await Promise.all([
      insertInstance(definitionId),
      insertInstance(definitionId),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(await instances.findLiveByKey('it-saga', 'GRN:grn-1')).toHaveLength(1);
  });

  it('releases the live key once the instance is terminal', async () => {
    const definitionId = await createDefinition();
    const instance = await insertInstance(definitionId);
    if (!instance) throw new Error('instance missing');

    const completed = await instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.COMPLETED,
      cursor: 1,
    });
    expect(completed?.status).toBe(SagaInstanceStatus.COMPLETED);
    expect(completed?.finishedAt).not.toBeNull();

    const again = await insertInstance(definitionId);
    expect(again).not.toBeNull();
    expect(again?.id).not.toBe(instance.id);
  });

  it('fences every write on the version', async () => {
    const definitionId = await createDefinition();
    const instance = await insertInstance(definitionId);
    if (!instance) throw new Error('instance missing');

    const first = await instances.updateCas(instance.id, instance.version, { cursor: 1 });
    expect(first?.version).toBe(instance.version + 1);

    const stale = await instances.updateCas(instance.id, instance.version, { cursor: 2 });
    expect(stale).toBeNull();
  });

  it('claims steps with a lease and re-claims after the lease expires', async () => {
    const definitionId = await createDefinition();
    const instance = await insertInstance(definitionId);
    if (!instance) throw new Error('instance missing');
    await steps.createIfAbsent({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      instanceId: instance.id,
      stepId: 'valuate',
      kind: SagaStepKind.DO,
      action: 'inventory.valuate',
      maxAttempts: 3,
      runAt: new Date(Date.now() - 1_000),
    });

    const claimed = await steps.claimBatch({
      now: new Date(),
      leaseMs: 60_000,
      batchSize: 10,
      workerId: 'worker-a',
      fairnessCap: 0,
    });
    expect(claimed).toHaveLength(1);
    expect(claimed[0].status).toBe(SagaStepStatus.RUNNING);
    expect(claimed[0].lockedBy).toBe('worker-a');

    const immediately = await steps.claimBatch({
      now: new Date(),
      leaseMs: 60_000,
      batchSize: 10,
      workerId: 'worker-b',
      fairnessCap: 0,
    });
    expect(immediately).toHaveLength(0);

    // A crashed worker's row is not claimable while RUNNING: the sweep finds the
    // stale lease, re-queues it, and only then may the next worker take it.
    const later = new Date(Date.now() + 120_000);
    const stale = await steps.findStaleRunning(later, 10);
    expect(stale.map(row => row.lockedBy)).toEqual(['worker-a']);

    await steps.reschedule(stale[0].id, stale[0].attempts, new Date(), 'lease expired');
    const afterLease = await steps.claimBatch({
      now: later,
      leaseMs: 60_000,
      batchSize: 10,
      workerId: 'worker-b',
      fairnessCap: 0,
    });
    expect(afterLease).toHaveLength(1);
    expect(afterLease[0].lockedBy).toBe('worker-b');
  });

  it('applies the fairness cap and releases the overflow rows', async () => {
    const definitionId = await createDefinition();
    const first = await insertInstance(definitionId, 'GRN:1');
    const second = await insertInstance(definitionId, 'GRN:2');
    if (!first || !second) throw new Error('instances missing');

    for (const instance of [first, second, first]) {
      await steps.createIfAbsent({
        tenantId: instance.tenantId,
        companyId: instance.companyId,
        instanceId: instance.id,
        stepId: `valuate-${randomUUID()}`,
        kind: SagaStepKind.DO,
        action: 'inventory.valuate',
        maxAttempts: 3,
        runAt: new Date(Date.now() - 1_000),
      });
    }

    const claimed = await steps.claimBatch({
      now: new Date(),
      leaseMs: 60_000,
      batchSize: 10,
      workerId: 'worker-a',
      fairnessCap: 1,
    });

    // Every row belongs to the same company, so the cap allows exactly one and
    // the overflow rows go back to PENDING untouched.
    expect(claimed).toHaveLength(1);
    const pending = await prisma.sagaStep.findMany({ where: { status: 'PENDING' } });
    expect(pending).toHaveLength(2);
    expect(pending.every(row => row.lockedBy === null && row.lockUntil === null)).toBe(true);
  });

  it('requeues with backoff and finds expired WAIT steps', async () => {
    const definitionId = await createDefinition();
    const instance = await insertInstance(definitionId);
    if (!instance) throw new Error('instance missing');

    const doRow = await steps.createIfAbsent({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      instanceId: instance.id,
      stepId: 'valuate',
      kind: SagaStepKind.DO,
      action: 'inventory.valuate',
      maxAttempts: 3,
      runAt: new Date(Date.now() - 1_000),
    });
    await steps.reschedule(doRow.id, 2, new Date(Date.now() + 5_000), 'retry later');

    const waitRow = await steps.createIfAbsent({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      instanceId: instance.id,
      stepId: 'wait-bill',
      kind: SagaStepKind.WAIT,
      eventName: 'ap.bill.posted',
      eventVersion: 1,
      maxAttempts: 3,
      runAt: new Date(Date.now() - 1_000),
    });

    const reloaded = await steps.findById(doRow.id);
    expect(reloaded?.status).toBe(SagaStepStatus.PENDING);
    expect(reloaded?.attempts).toBe(2);
    expect(reloaded?.lastError).toBe('retry later');

    const expired = await steps.findExpiredWaits(new Date(), 10);
    expect(expired.map(row => row.id)).toContain(waitRow.id);
    expect(expired.find(row => row.id === waitRow.id)?.eventName).toBe('ap.bill.posted');
  });

  it('dedupes saga inbox rows per consumer and instance', async () => {
    const definitionId = await createDefinition();
    const instance = await insertInstance(definitionId);
    if (!instance) throw new Error('instance missing');
    const eventId = randomUUID();

    const input = {
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      consumer: `it-saga:${instance.id}`,
      eventId,
      eventName: 'ap.bill.posted',
      eventVersion: 1,
      correlationKey: instance.correlationKey,
      instanceId: instance.id,
      payload: { billId: 'bill-1' },
      payloadHash: 'hash-1',
    };

    const first = await inbox.tryInsert(input);
    expect(first).not.toBeNull();
    expect(await inbox.tryInsert(input)).toBeNull();

    if (!first) throw new Error('inbox row missing');
    await inbox.markBuffered(first.id, instance.correlationKey, instance.id);
    const buffered = await inbox.listBuffered(instance.id, 'ap.bill.posted', 1, 10);
    expect(buffered).toHaveLength(1);

    await inbox.markConsumed(first.id);
    expect(await inbox.listBuffered(instance.id, 'ap.bill.posted', 1, 10)).toHaveLength(0);
  });
});
