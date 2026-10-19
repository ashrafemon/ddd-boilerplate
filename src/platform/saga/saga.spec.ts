import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { OutboxEnvelope } from '@platform/outbox/outbox.types';
import {
  SagaCompanyConfigRepository,
  SagaDefinitionRepository,
  SagaInboxRepository,
  SagaInstanceRepository,
  SagaStepRepository,
} from './repositories/prisma-saga.repository';
import {
  SagaDefinitionBody,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from './saga.types';
import {
  evaluateCondition,
  evaluateExpression,
  parseDuration,
  renderTemplate,
} from './application/expression';
import { PlanBuilder } from './application/plan-builder';
import { SagaEngine } from './application/saga-engine';
import { SagaRouter } from './application/saga-router';

// ─── expression ─────────────────────────────────────────────────────────────

describe('saga expression evaluator', () => {
  const scope = {
    event: { totalValue: 5, source: { type: 'BILL' }, grnId: 'G-1' },
    saga: { sourceType: 'BILL', region: 'EU' },
    company: { settings: { finance: { grnAccrual: true } } },
    steps: { valuate: { status: 'DONE', output: { totalValue: 42 } } },
  };

  it('evaluates comparison, membership and property paths', () => {
    expect(evaluateCondition('event.totalValue != null', scope)).toBe(true);
    expect(evaluateCondition("event.source.type in ['BILL', 'DIRECT']", scope)).toBe(true);
    expect(evaluateCondition("saga.sourceType != 'DIRECT'", scope)).toBe(true);
    expect(evaluateCondition('company.settings.finance.grnAccrual == true', scope)).toBe(true);
    expect(evaluateCondition('steps.valuate.output.totalValue > 10', scope)).toBe(true);
    expect(evaluateCondition('event.totalValue > 10', scope)).toBe(false);
  });

  it('honours && / || precedence and grouping', () => {
    expect(evaluateCondition("event.source.type == 'BILL' && saga.region == 'EU'", scope)).toBe(
      true,
    );
    expect(evaluateCondition("event.source.type == 'X' || saga.region == 'EU'", scope)).toBe(true);
    expect(
      evaluateCondition(
        "(event.source.type == 'X' || saga.region == 'EU') && event.totalValue == 5",
        scope,
      ),
    ).toBe(true);
  });

  it('treats an absent condition as true and renders templates', () => {
    expect(evaluateCondition(undefined, scope)).toBe(true);
    expect(renderTemplate('GRN:{{event.grnId}}', scope)).toBe('GRN:G-1');
    expect(evaluateExpression('steps.valuate.output.totalValue', scope)).toBe(42);
  });

  it('rejects malformed expressions', () => {
    expect(() => evaluateExpression('event.total +', scope)).toThrow(/Invalid saga expression/);
    expect(() => parseDuration('nope')).toThrow(/Invalid ISO-8601 duration/);
  });

  it('parses ISO-8601 durations to milliseconds', () => {
    expect(parseDuration('P7D')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('P1W')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDuration('PT30M')).toBe(30 * 60 * 1000);
  });
});

// ─── plan builder ───────────────────────────────────────────────────────────

describe('PlanBuilder', () => {
  const builder = new PlanBuilder();
  const definition: SagaDefinitionBody = {
    key: 'goods-receipt-valuation',
    version: 1,
    requires: [],
    start: { event: { name: 'GoodsReceived', version: 1 }, key: 'GRN:{{event.grnId}}' },
    steps: [
      {
        id: 'valuate',
        policy: 'required',
        do: 'inventory.valuateReceipt',
        undo: 'inventory.revalueReceipt',
      },
      { id: 'accrue', policy: 'standard', do: 'finance.accrue', undo: 'finance.reverseAccrual' },
      { id: 'notify', policy: 'optional', do: 'notification.send' },
    ],
  };
  const base = { definition, features: new Set<string>(), settings: {}, defaultMaxAttempts: 5 };

  it('enables required + standard steps and skips optional ones by default', () => {
    const plan = builder.build({ ...base, overlay: null });
    expect(plan?.steps.map(step => step.id)).toEqual(['valuate', 'accrue']);
  });

  it('narrows with the overlay — optional on, standard off, required never off', () => {
    const plan = builder.build({
      ...base,
      overlay: {
        steps: {
          accrue: { enabled: false },
          notify: { enabled: true },
          valuate: { enabled: false },
        },
      },
    });
    expect(plan?.steps.map(step => step.id)).toEqual(['valuate', 'notify']);
  });

  it('returns null when the overlay disables the saga entirely', () => {
    expect(builder.build({ ...base, overlay: { enabled: false } })).toBeNull();
  });

  it('returns null when a required step is missing features (no saga for this company)', () => {
    const withRequires: SagaDefinitionBody = {
      ...definition,
      steps: [{ id: 'valuate', policy: 'required', do: 'x', requires: ['valuation'] }],
    };
    expect(builder.build({ ...base, definition: withRequires, overlay: null })).toBeNull();
  });

  it('bypasses a standard step whose features are missing', () => {
    const withRequires: SagaDefinitionBody = {
      ...definition,
      steps: [
        { id: 'valuate', policy: 'required', do: 'x' },
        { id: 'accrue', policy: 'standard', do: 'y', requires: ['finance'] },
      ],
    };
    const plan = builder.build({ ...base, definition: withRequires, overlay: null });
    expect(plan?.steps.map(step => step.id)).toEqual(['valuate']);
  });

  it('AND-combines default and overlay conditions', () => {
    const withIf: SagaDefinitionBody = {
      ...definition,
      steps: [{ id: 'accrue', policy: 'required', do: 'x', if: 'saga.a == 1' }],
    };
    const plan = builder.build({
      ...base,
      definition: withIf,
      overlay: { steps: { accrue: { if: "saga.sourceType != 'DIRECT'" } } },
    });
    expect(plan?.steps[0].if).toBe("(saga.a == 1) && (saga.sourceType != 'DIRECT')");
  });
});

// ─── engine + router ────────────────────────────────────────────────────────

const sagaConfig = {
  workerLeaseSeconds: 60,
  claimBatchSize: 20,
  fairnessCap: 5,
  sweepIntervalMs: 10_000,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 600_000,
  defaultMaxAttempts: 5,
  inboxRetentionDays: 30,
};

function makeInstance(overrides: Partial<SagaInstanceRecord> = {}): SagaInstanceRecord {
  return {
    id: 'inst-1',
    tenantId: 't1',
    organizationId: 'c1',
    sagaKey: 'goods-receipt-valuation',
    definitionId: 'def-1',
    configId: null,
    rootRefType: null,
    rootRefId: null,
    correlationKey: 'GRN:G-1',
    status: SagaInstanceStatus.RUNNING,
    reason: null,
    plan: {
      sagaKey: 'goods-receipt-valuation',
      version: 1,
      steps: [
        {
          id: 'valuate',
          kind: SagaStepKind.DO,
          action: 'inventory.valuateReceipt',
          undo: 'inventory.revalueReceipt',
          maxAttempts: 5,
          pivot: false,
        },
      ],
      cancelOn: [],
      onComplete: { emit: 'SagaCompleted' },
    },
    context: { settings: {}, event: {}, start: {} },
    cursor: 0,
    waitingEvent: null,
    cancelRequestedAt: null,
    error: null,
    deadlineAt: null,
    version: 1,
    ...overrides,
  };
}

function makeStep(overrides: Partial<SagaStepRecord> = {}): SagaStepRecord {
  return {
    id: 'row-1',
    tenantId: 't1',
    organizationId: 'c1',
    instanceId: 'inst-1',
    stepId: 'valuate',
    kind: SagaStepKind.DO,
    action: 'inventory.valuateReceipt',
    status: SagaStepStatus.PENDING,
    attempt: 0,
    maxAttempts: 5,
    runAt: new Date(),
    lockedBy: null,
    lockUntil: null,
    input: null,
    output: null,
    error: null,
    ...overrides,
  };
}

function buildEngine() {
  const instances = {
    findById: jest.fn(),
    tryInsertLive: jest.fn(),
    updateCas: jest.fn(),
    findLiveByKey: jest.fn(),
    findWaitingByEvent: jest.fn(),
  };
  const steps = {
    findByInstance: jest.fn(),
    createIfAbsent: jest.fn(),
    markFailed: jest.fn(),
    markDone: jest.fn(),
    markSkipped: jest.fn(),
    reschedule: jest.fn(),
    claimBatch: jest.fn(),
    findExpiredWaits: jest.fn(),
    findStaleRunning: jest.fn(),
  };
  const inbox = {
    tryInsert: jest.fn(),
    markConsumed: jest.fn(),
    markBuffered: jest.fn(),
    markIgnored: jest.fn(),
    listBuffered: jest.fn(),
    purgeOlderThan: jest.fn(),
  };
  const outbox = { append: jest.fn() };
  const configService = { getSaga: () => sagaConfig };
  const engine = new SagaEngine(
    instances as unknown as SagaInstanceRepository,
    steps as unknown as SagaStepRepository,
    inbox as unknown as SagaInboxRepository,
    outbox,
    configService as unknown as ConfigService,
  );
  return { engine, instances, steps, inbox, outbox };
}

describe('SagaEngine', () => {
  it('queues the next DO step as PENDING and stops for the worker', async () => {
    const { engine, instances, steps } = buildEngine();
    const instance = makeInstance();
    instances.tryInsertLive.mockResolvedValue(instance);
    instances.findById.mockResolvedValue(instance);
    steps.findByInstance.mockResolvedValue([]);
    steps.createIfAbsent.mockResolvedValue(makeStep());
    instances.updateCas.mockResolvedValue({ ...instance, version: 2 });

    await engine.createAndAdvance({
      tenantId: 't1',
      organizationId: 'c1',
      sagaKey: instance.sagaKey,
      definitionId: 'def-1',
      configId: null,
      rootRefType: null,
      rootRefId: null,
      correlationKey: 'GRN:G-1',
      plan: instance.plan,
      context: {},
      deadlineAt: null,
    });

    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        stepId: 'valuate',
        kind: SagaStepKind.DO,
        status: SagaStepStatus.PENDING,
      }),
    );
    expect(instances.updateCas).toHaveBeenCalledWith(
      'inst-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.RUNNING }),
    );
  });

  it('completes the instance and emits onComplete when the plan is exhausted', async () => {
    const { engine, instances, steps, outbox } = buildEngine();
    const instance = makeInstance();
    instances.findById.mockResolvedValue(instance);
    steps.findByInstance.mockResolvedValue([makeStep({ status: SagaStepStatus.DONE })]);
    steps.createIfAbsent.mockResolvedValue(makeStep({ status: SagaStepStatus.DONE }));
    instances.updateCas.mockResolvedValue({ ...instance, status: SagaInstanceStatus.COMPLETED });

    await engine.advance('inst-1');

    expect(instances.updateCas).toHaveBeenCalledWith(
      'inst-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.COMPLETED, cursor: 1 }),
    );
    expect(outbox.append).toHaveBeenCalledTimes(1);
  });

  it('compensates completed DO steps in reverse when a step fails', async () => {
    const { engine, instances, steps } = buildEngine();
    const plan = makeInstance().plan;
    plan.steps = [
      {
        id: 'valuate',
        kind: SagaStepKind.DO,
        action: 'inventory.valuateReceipt',
        undo: 'inventory.revalueReceipt',
        maxAttempts: 5,
        pivot: false,
      },
      {
        id: 'accrue',
        kind: SagaStepKind.DO,
        action: 'finance.accrue',
        undo: 'finance.reverse',
        maxAttempts: 5,
        pivot: false,
      },
    ];
    const instance = makeInstance({ plan, cursor: 1 });
    instances.findById.mockResolvedValue(instance);
    steps.findByInstance.mockResolvedValue([
      makeStep({ status: SagaStepStatus.DONE, output: { v: 1 } }),
    ]);
    instances.updateCas.mockResolvedValue({ ...instance, status: SagaInstanceStatus.COMPENSATING });

    await engine.onDoFailed('inst-1', 'accrue', 'accrual blew up');

    expect(steps.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: SagaStepKind.UNDO,
        stepId: 'valuate',
        action: 'inventory.revalueReceipt',
      }),
    );
    expect(instances.updateCas).toHaveBeenCalledWith(
      'inst-1',
      1,
      expect.objectContaining({ status: SagaInstanceStatus.COMPENSATING }),
    );
  });
});

function buildRouter(
  overrides: {
    definition?: SagaDefinitionBody;
    createAndAdvance?: jest.Mock;
    findActiveByEvent?: jest.Mock;
  } = {},
) {
  const definition = overrides.definition ?? {
    key: 'goods-receipt-valuation',
    version: 1,
    start: { event: { name: 'GoodsReceived', version: 1 }, key: 'GRN:{{event.grnId}}' },
    steps: [{ id: 'valuate', policy: 'required', do: 'inventory.valuateReceipt' }],
  };
  const definitions = {
    findActiveByEvent: overrides.findActiveByEvent ?? jest.fn(),
    listActive: jest.fn().mockResolvedValue([]),
  };
  const configs = { findActive: jest.fn().mockResolvedValue(null) };
  const instances = {
    findLiveByKey: jest.fn().mockResolvedValue([]),
    findWaitingByEvent: jest.fn().mockResolvedValue([]),
  };
  const engine = {
    createAndAdvance: overrides.createAndAdvance ?? jest.fn().mockResolvedValue(makeInstance()),
    cancel: jest.fn(),
    bufferForInstance: jest.fn(),
    advance: jest.fn(),
  };
  const featureGate = { enabled: jest.fn().mockResolvedValue(new Set(['valuation'])) };
  const settings = { get: jest.fn().mockResolvedValue({}) };
  const requestContext = {
    run: jest.fn((_patch: unknown, fn: () => unknown) => fn()),
  };
  const router = new SagaRouter(
    definitions as unknown as SagaDefinitionRepository,
    configs as unknown as SagaCompanyConfigRepository,
    instances as unknown as SagaInstanceRepository,
    new PlanBuilder(),
    engine as unknown as SagaEngine,
    featureGate,
    settings,
    requestContext as unknown as RequestContextPort,
    { getSaga: () => sagaConfig } as unknown as ConfigService,
  );
  return { router, definitions, engine, definition };
}

function envelope(overrides: Partial<OutboxEnvelope> = {}): OutboxEnvelope {
  return {
    eventId: 'evt-1',
    eventType: 'GoodsReceived',
    eventVersion: 1,
    tenantId: 't1',
    organizationId: 'c1',
    aggregateType: 'GoodsReceiptNote',
    aggregateId: 'grn-1',
    payload: { grnId: 'G-1' },
    occurredAt: new Date(),
    ...overrides,
  };
}

describe('SagaRouter', () => {
  it('starts a saga when the start event matches and the plan is non-empty', async () => {
    const createAndAdvance = jest.fn().mockResolvedValue(makeInstance());
    const { router, definitions, definition } = buildRouter({ createAndAdvance });
    definitions.findActiveByEvent.mockResolvedValue({
      id: 'def-1',
      sagaKey: definition.key,
      definition,
    });

    await router.accept(envelope());

    expect(createAndAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ sagaKey: definition.key, correlationKey: 'GRN:G-1' }),
    );
  });

  it('ignores its own emitted events (loop guard)', async () => {
    const createAndAdvance = jest.fn();
    const { router, definitions } = buildRouter({ createAndAdvance });

    await router.accept(envelope({ aggregateType: 'Saga' }));

    expect(definitions.findActiveByEvent).not.toHaveBeenCalled();
    expect(createAndAdvance).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown event', async () => {
    const createAndAdvance = jest.fn();
    const { router, definitions } = buildRouter({ createAndAdvance });
    definitions.findActiveByEvent.mockResolvedValue(null);

    await router.accept(envelope({ eventType: 'SomethingElse' }));

    expect(createAndAdvance).not.toHaveBeenCalled();
  });
});
