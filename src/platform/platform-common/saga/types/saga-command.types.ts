import { OutboxEnvelope } from '@platform/platform-common/outbox/types/outbox.types';
import { SagaStepKind } from './saga.types';

/** Routing keys on the platform topic exchange (`erp.events`). */
export const SAGA_COMMAND_ROUTING_KEY = 'saga.command';
export const SAGA_STEP_RESULT_ROUTING_KEY = 'saga.step.result';

/** Durable queues owned by the saga module. */
export const SAGA_COMMAND_QUEUE = 'saga.commands.erp';
export const SAGA_STEP_RESULT_QUEUE = 'saga.step-results.erp';

/**
 * One unit of business work, published to the broker instead of being executed
 * by the saga in-process. `idempotencyKey` is the `saga_steps` row id, so a
 * redelivered command re-runs against the same business idempotency record.
 */
export interface SagaStepCommand {
  tenantId: string;
  companyId: string;
  sagaKey: string;
  instanceId: string;
  /** Plan step id (`valuate`). */
  stepId: string;
  /** `saga_steps` row id — the action's idempotency key. */
  stepRowId: string;
  kind: SagaStepKind;
  action: string;
  correlationKey: string;
  input: Record<string, unknown>;
  /** Output of the matching DO step, present for UNDO commands. */
  doOutput?: Record<string, unknown>;
}

/** The outcome a business consumer reports back for one command. */
export interface SagaStepResult {
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  stepRowId: string;
  kind: SagaStepKind;
  outcome: 'ok' | 'retry' | 'fail';
  output?: Record<string, unknown> | null;
  error?: string | null;
}

/** Command → the canonical platform envelope that carries it. */
export function toCommandEnvelope(command: SagaStepCommand): OutboxEnvelope {
  return {
    eventId: `${command.stepRowId}:command`,
    eventType: SAGA_COMMAND_ROUTING_KEY,
    eventVersion: 1,
    tenantId: command.tenantId,
    companyId: command.companyId,
    aggregateType: 'Saga',
    aggregateId: command.instanceId,
    payload: { ...command },
    occurredAt: new Date(),
    correlationId: command.instanceId,
  };
}

/** Delivered command body → `SagaStepCommand`, or `null` when it is not one. */
export function fromCommandEnvelope(value: unknown): SagaStepCommand | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.instanceId !== 'string' ||
    typeof candidate.stepRowId !== 'string' ||
    typeof candidate.stepId !== 'string' ||
    typeof candidate.action !== 'string' ||
    typeof candidate.sagaKey !== 'string' ||
    typeof candidate.tenantId !== 'string' ||
    typeof candidate.companyId !== 'string'
  ) {
    return null;
  }
  return {
    tenantId: candidate.tenantId,
    companyId: candidate.companyId,
    sagaKey: candidate.sagaKey,
    instanceId: candidate.instanceId,
    stepId: candidate.stepId,
    stepRowId: candidate.stepRowId,
    kind: candidate.kind === SagaStepKind.UNDO ? SagaStepKind.UNDO : SagaStepKind.DO,
    action: candidate.action,
    correlationKey: typeof candidate.correlationKey === 'string' ? candidate.correlationKey : '',
    input:
      typeof candidate.input === 'object' && candidate.input !== null
        ? (candidate.input as Record<string, unknown>)
        : {},
    doOutput:
      typeof candidate.doOutput === 'object' && candidate.doOutput !== null
        ? (candidate.doOutput as Record<string, unknown>)
        : undefined,
  };
}

/** Result → the canonical envelope that carries it back. */
export function toResultEnvelope(result: SagaStepResult): OutboxEnvelope {
  return {
    eventId: `${result.stepRowId}:result:${result.outcome}`,
    eventType: SAGA_STEP_RESULT_ROUTING_KEY,
    eventVersion: 1,
    tenantId: result.tenantId,
    companyId: result.companyId,
    aggregateType: 'Saga',
    aggregateId: result.instanceId,
    payload: { ...result },
    occurredAt: new Date(),
    correlationId: result.instanceId,
  };
}

/** Delivered result body → `SagaStepResult`, or `null` when it is not one. */
export function fromResultEnvelope(value: unknown): SagaStepResult | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.instanceId !== 'string' ||
    typeof candidate.stepRowId !== 'string' ||
    typeof candidate.stepId !== 'string'
  ) {
    return null;
  }
  const outcome =
    candidate.outcome === 'ok' || candidate.outcome === 'retry' || candidate.outcome === 'fail'
      ? candidate.outcome
      : 'fail';

  return {
    tenantId: typeof candidate.tenantId === 'string' ? candidate.tenantId : '',
    companyId: typeof candidate.companyId === 'string' ? candidate.companyId : '',
    instanceId: candidate.instanceId,
    stepId: candidate.stepId,
    stepRowId: candidate.stepRowId,
    kind: candidate.kind === SagaStepKind.UNDO ? SagaStepKind.UNDO : SagaStepKind.DO,
    outcome,
    output:
      typeof candidate.output === 'object' && candidate.output !== null
        ? (candidate.output as Record<string, unknown>)
        : null,
    error: typeof candidate.error === 'string' ? candidate.error : null,
  };
}
