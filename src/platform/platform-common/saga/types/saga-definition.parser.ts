import { SagaDefinitionBody, SagaOnTimeout, SagaStepPolicy, SagaStepSpec } from './saga.types';
import {
  SagaDocumentAction,
  SagaDocumentEventRef,
  SagaDocumentStep,
  SagaDefinitionDocument,
} from './saga-definition.document';

/**
 * Raised when a published definition cannot be normalised. The register use case
 * turns it into a client error — an invalid definition is rejected at publish
 * time, never half-applied (workbook `8-Saga` flow step 1).
 */
export class SagaDefinitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SagaDefinitionValidationError';
  }
}

/**
 * Named retry profiles. `standard` is the workbook default and means "use the
 * platform default attempt count", so it produces no override at all.
 */
const RETRY_POLICIES: Record<string, { maxAttempts: number } | null> = {
  standard: null,
  aggressive: { maxAttempts: 5 },
  none: { maxAttempts: 1 },
};

const POLICIES: readonly SagaStepPolicy[] = ['required', 'standard', 'optional'];
const ON_TIMEOUT: readonly SagaOnTimeout[] = ['skip', 'compensate'];

function fail(message: string): never {
  throw new SagaDefinitionValidationError(message);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireVersion(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(`${label} must be a positive integer`);
  }
  return value;
}

function toEventRef(ref: SagaDocumentEventRef | undefined, label: string) {
  if (!ref) {
    fail(`${label} is required`);
  }
  return {
    name: requireText(ref.name, `${label}.name`),
    version: requireVersion(ref.version, `${label}.version`),
  };
}

function toActionName(
  action: SagaDocumentAction | string | undefined,
  label: string,
): string | undefined {
  if (action === undefined || action === null) {
    return undefined;
  }
  const name = typeof action === 'string' ? action : action.name;
  return requireText(name, label);
}

function toPolicy(step: SagaDocumentStep): SagaStepPolicy {
  const raw = step.policy ?? 'standard';
  const policy = String(raw).toLowerCase() as SagaStepPolicy;
  if (!POLICIES.includes(policy)) {
    fail(`step "${step.id}" has unknown policy "${raw}"`);
  }
  return policy;
}

function toOnTimeout(step: SagaDocumentStep): SagaOnTimeout | undefined {
  if (step.onTimeout === undefined) {
    return undefined;
  }
  const value = String(step.onTimeout).toLowerCase() as SagaOnTimeout;
  if (!ON_TIMEOUT.includes(value)) {
    fail(`step "${step.id}" has unknown onTimeout "${step.onTimeout}"`);
  }
  return value;
}

function toRetry(step: SagaDocumentStep): { maxAttempts: number } | undefined {
  if (step.retry) {
    return { maxAttempts: requireVersion(step.retry.maxAttempts, `step "${step.id}" retry`) };
  }
  if (step.retryPolicy === undefined) {
    return undefined;
  }
  const profile = String(step.retryPolicy).toLowerCase();
  if (!(profile in RETRY_POLICIES)) {
    fail(`step "${step.id}" has unknown retryPolicy "${step.retryPolicy}"`);
  }
  return RETRY_POLICIES[profile] ?? undefined;
}

function toStep(step: SagaDocumentStep): SagaStepSpec {
  const id = requireText(step.id, 'step id');
  const action = toActionName(step.action, `step "${id}" action`) ?? step.do;
  const undo = toActionName(step.compensation, `step "${id}" compensation`) ?? step.undo;
  const waitFor = step.waitFor ? toEventRef(step.waitFor, `step "${id}" waitFor`) : undefined;

  const declaredKind = step.kind ? String(step.kind).toUpperCase() : undefined;
  if (declaredKind !== undefined && declaredKind !== 'DO' && declaredKind !== 'WAIT') {
    fail(`step "${id}" has unknown kind "${step.kind}"`);
  }
  if (declaredKind === 'WAIT' && !waitFor) {
    fail(`WAIT step "${id}" needs a waitFor event`);
  }
  if (declaredKind === 'DO' && !action) {
    fail(`DO step "${id}" needs an action`);
  }
  if (!waitFor && !action) {
    fail(`step "${id}" needs either an action or a waitFor event`);
  }
  if (step.when && step.acceptedEventCondition) {
    fail(`step "${id}" cannot set both when and acceptedEventCondition`);
  }

  return {
    id,
    policy: toPolicy(step),
    do: action,
    undo,
    input: step.input,
    waitFor,
    match: step.match,
    when: step.acceptedEventCondition ?? step.when,
    requires: step.requires,
    if: step.if,
    timeout: step.timeout,
    onTimeout: waitFor ? toOnTimeout(step) : undefined,
    retry: toRetry(step),
    pivot: step.pivot ?? false,
  };
}

/**
 * Normalise a published definition document into the canonical body.
 *
 * Unknown enums, missing actions and duplicate step ids are rejected here rather
 * than at runtime: a definition that cannot be planned must never reach
 * `saga_definitions` as ACTIVE.
 */
export function parseSagaDefinition(document: SagaDefinitionDocument): SagaDefinitionBody {
  if (!document) {
    fail('definition is required');
  }
  const key = requireText(document.key, 'definition key');
  const version = requireVersion(document.version, 'definition version');
  const start = document.start;
  if (!start) {
    fail(`definition "${key}" needs a start block`);
  }
  const startEvent = toEventRef(start.event, `definition "${key}" start.event`);
  const startKey = requireText(start.key, `definition "${key}" start.key`);

  if (!Array.isArray(document.steps) || document.steps.length === 0) {
    fail(`definition "${key}" needs at least one step`);
  }
  const steps = document.steps.map(toStep);
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) {
      fail(`definition "${key}" repeats step id "${step.id}"`);
    }
    seen.add(step.id);
  }

  const emit = document.onComplete?.emit;
  const emitName =
    emit === undefined
      ? undefined
      : typeof emit === 'string'
        ? requireText(emit, 'onComplete.emit')
        : requireText(emit.name, 'onComplete.emit.name');

  return {
    key,
    version,
    requires: document.requires,
    start: {
      event: startEvent,
      key: startKey,
      when: start.when,
      context: start.context,
    },
    cancelOn: document.cancelOn?.map((ref, index) =>
      toEventRef(ref, `definition "${key}" cancelOn[${index}]`),
    ),
    steps,
    onComplete: emitName ? { emit: emitName } : undefined,
  };
}
