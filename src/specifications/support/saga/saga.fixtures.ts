import {
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaPlan,
  SagaPlanStep,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from '@platform/platform-common/saga/types/saga.types';

/**
 * Shared saga fixtures.
 *
 * A saga decision is only meaningful against a real plan/step/cursor triple, so
 * these builders keep the specs about the transition under test instead of
 * repeating twenty-line literals. Every builder returns a fresh object.
 */

export function planStep(overrides: Partial<SagaPlanStep> = {}): SagaPlanStep {
  return {
    id: 'step-1',
    kind: SagaStepKind.DO,
    action: 'inventory.valuateReceipt',
    undo: 'inventory.unvaluateReceipt',
    maxAttempts: 3,
    pivot: false,
    ...overrides,
  };
}

export function plan(steps: SagaPlanStep[], overrides: Partial<SagaPlan> = {}): SagaPlan {
  return { sagaKey: 'grn-to-invoice', version: 1, steps, cancelOn: [], ...overrides };
}

export function instance(overrides: Partial<SagaInstanceRecord> = {}): SagaInstanceRecord {
  return {
    id: 'instance-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    sagaKey: 'grn-to-invoice',
    definitionId: 'definition-1',
    configId: null,
    rootRefType: null,
    rootRefId: null,
    correlationKey: 'GRN:grn-1',
    status: SagaInstanceStatus.RUNNING,
    reason: null,
    plan: plan([planStep()]),
    context: { event: { grnId: 'grn-1' }, settings: {}, start: {} },
    cursor: 0,
    waitingEvent: null,
    cancelRequestedAt: null,
    lastError: null,
    deadlineAt: null,
    startedAt: new Date('2024-01-01T00:00:00Z'),
    finishedAt: null,
    version: 1,
    ...overrides,
  };
}

export function step(overrides: Partial<SagaStepRecord> = {}): SagaStepRecord {
  return {
    id: 'step-row-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    instanceId: 'instance-1',
    stepId: 'step-1',
    kind: SagaStepKind.DO,
    action: 'inventory.valuateReceipt',
    eventName: null,
    eventVersion: null,
    status: SagaStepStatus.RUNNING,
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date('2024-01-01T00:00:00Z'),
    lockedBy: 'worker-1',
    lockUntil: new Date('2024-01-01T00:01:00Z'),
    input: null,
    output: null,
    lastError: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}
