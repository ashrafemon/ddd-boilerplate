import {
  SagaInstanceRecord,
  SagaScope,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from './saga.types';
import { evaluateExpression } from './saga-expression';

/**
 * Pure scope helpers shared by the advance/settle use cases.
 *
 * The scope is the only thing an expression can read: the trigger event, the
 * frozen instance context, the company settings snapshot and every earlier step
 * outcome. Keeping it derivable from rows (never from mutable state) is what
 * makes a resumed instance evaluate `if`/`when`/`input` exactly as it did before
 * a crash.
 */
export function buildScope(instance: SagaInstanceRecord, stepRows: SagaStepRecord[]): SagaScope {
  const context = instance.context ?? {};
  const steps: SagaScope['steps'] = {};
  for (const row of stepRows) {
    steps[row.stepId] = { status: row.status, output: row.output ?? {} };
  }
  const startData = (context.start as Record<string, unknown> | undefined) ?? {};
  return {
    event: (context.event as Record<string, unknown> | undefined) ?? {},
    saga: { ...startData, key: instance.correlationKey, correlationKey: instance.correlationKey },
    company: { settings: (context.settings as Record<string, unknown> | undefined) ?? {} },
    steps,
  };
}

/** Resolve a plan step's `input` expressions against the scope. */
export function buildInput(
  step: { input?: Record<string, string> },
  scope: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!step.input) {
    return null;
  }
  const resolved: Record<string, unknown> = {};
  for (const [field, expression] of Object.entries(step.input)) {
    resolved[field] = evaluateExpression(expression, scope);
  }
  return resolved;
}

/** First failed UNDO row's error, so a compensated instance keeps the reason. */
export function failedUndoError(rows: SagaStepRecord[]): string | null {
  const failed = rows.find(
    row => row.kind === SagaStepKind.UNDO && row.status === SagaStepStatus.FAILED,
  );
  return failed?.lastError ?? null;
}
