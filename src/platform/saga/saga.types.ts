/**
 * Saga types — statuses, the definition/overlay/plan shapes, port data and the
 * `ISagaConfig` shape. Design 08: linear steps, three small expressions, a safe
 * evaluator, defaults + company overlays that only narrow.
 */

// ─── Statuses ───────────────────────────────────────────────────────────────

export enum SagaInstanceStatus {
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPENSATING = 'COMPENSATING',
  COMPLETED = 'COMPLETED',
  COMPENSATED = 'COMPENSATED',
  CANCELLED = 'CANCELLED',
  FAILED_MANUAL = 'FAILED_MANUAL',
}

export enum SagaInstanceReason {
  STEP_FAILED = 'STEP_FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED_BY_EVENT = 'CANCELLED_BY_EVENT',
  CANCELLED_BY_USER = 'CANCELLED_BY_USER',
}

export enum SagaDefinitionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

export enum SagaCompanyConfigStatus {
  ACTIVE = 'ACTIVE',
  INVALID = 'INVALID',
  RETIRED = 'RETIRED',
}

export enum SagaStepKind {
  DO = 'DO',
  WAIT = 'WAIT',
  UNDO = 'UNDO',
}

export enum SagaStepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}

export enum SagaInboxStatus {
  RECEIVED = 'RECEIVED',
  BUFFERED = 'BUFFERED',
  CONSUMED = 'CONSUMED',
  IGNORED = 'IGNORED',
}

// ─── Definition format (platform default) ───────────────────────────────────

export type SagaStepPolicy = 'required' | 'standard' | 'optional';
export type SagaOnTimeout = 'skip' | 'compensate';

export interface SagaEventRef {
  name: string;
  version: number;
}

export interface SagaStartSpec {
  event: SagaEventRef;
  /** Optional filter evaluated against the trigger event. */
  when?: string;
  /** Correlation-key template, e.g. `GRN:{{event.grnId}}`. */
  key: string;
  /** prop name → expression over the trigger event. */
  context?: Record<string, string>;
}

export interface SagaStepSpec {
  id: string;
  policy: SagaStepPolicy;
  /** Command on one aggregate via its application service. */
  do?: string;
  /** Business reversal (reversal document, never delete). */
  undo?: string;
  /** input field → expression over earlier outputs. */
  input?: Record<string, string>;
  waitFor?: SagaEventRef;
  /** Correlation-key template that must equal the instance key. */
  match?: string;
  /** Per-event filter for a WAIT step. */
  when?: string;
  /** Feature keys the step needs (missing → bypass). */
  requires?: string[];
  /** Condition evaluated when the step is reached (false → bypass). */
  if?: string;
  /** ISO-8601 duration, e.g. `P7D`, `PT30M`. */
  timeout?: string;
  onTimeout?: SagaOnTimeout;
  retry?: { maxAttempts: number };
  /** Point of no return — after it the saga only moves forward. */
  pivot?: boolean;
}

export interface SagaDefinitionBody {
  key: string;
  version: number;
  requires?: string[];
  start: SagaStartSpec;
  cancelOn?: SagaEventRef[];
  steps: SagaStepSpec[];
  onComplete?: { emit: string };
}

/** Company overlay — narrows only; never adds steps or disables required ones. */
export interface SagaStepOverlay {
  enabled?: boolean;
  if?: string;
  when?: string;
  timeout?: string;
  retry?: { maxAttempts: number };
}

export interface SagaOverlay {
  enabled?: boolean;
  start?: { when?: string };
  steps?: Record<string, SagaStepOverlay>;
}

// ─── Plan (merged snapshot, frozen on the instance) ─────────────────────────

export interface SagaPlanStep {
  id: string;
  kind: SagaStepKind.DO | SagaStepKind.WAIT;
  action?: string;
  undo?: string;
  input?: Record<string, string>;
  waitFor?: SagaEventRef;
  match?: string;
  when?: string;
  if?: string;
  timeout?: string;
  onTimeout?: SagaOnTimeout;
  maxAttempts: number;
  pivot: boolean;
}

export interface SagaPlan {
  sagaKey: string;
  version: number;
  steps: SagaPlanStep[];
  cancelOn: SagaEventRef[];
  onComplete?: { emit: string };
}

// ─── Persisted rows ─────────────────────────────────────────────────────────

export interface SagaDefinitionRecord {
  id: string;
  sagaKey: string;
  version: number;
  eventName: string;
  eventVersion: number;
  status: SagaDefinitionStatus;
  definition: SagaDefinitionBody;
  createdAt: Date;
}

export interface SagaCompanyConfigRecord {
  id: string;
  tenantId: string;
  companyId: string;
  definitionId: string;
  sagaKey: string;
  baseVersion: number;
  overlay: SagaOverlay;
  status: SagaCompanyConfigStatus;
}

export interface SagaInstanceRecord {
  id: string;
  tenantId: string;
  companyId: string;
  sagaKey: string;
  definitionId: string;
  configId: string | null;
  rootRefType: string | null;
  rootRefId: string | null;
  correlationKey: string;
  status: SagaInstanceStatus;
  reason: SagaInstanceReason | null;
  plan: SagaPlan;
  context: Record<string, unknown>;
  cursor: number;
  waitingEvent: string | null;
  cancelRequestedAt: Date | null;
  error: string | null;
  deadlineAt: Date | null;
  version: number;
}

export interface SagaStepRecord {
  id: string;
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: SagaStepKind;
  action: string | null;
  status: SagaStepStatus;
  attempt: number;
  maxAttempts: number;
  runAt: Date;
  lockedBy: string | null;
  lockUntil: Date | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
}

export interface SagaInboxRecord {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: Record<string, unknown>;
  status: SagaInboxStatus;
  receivedAt: Date;
}

// ─── Trigger / inbound envelope ─────────────────────────────────────────────

export interface SagaTriggerEvent {
  eventId: string;
  eventName: string;
  eventVersion: number;
  tenantId: string;
  companyId: string;
  /** correlation id of the originating process (loop guard via causationId). */
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
}

// ─── Action port data ───────────────────────────────────────────────────────

export type SagaActionOutcome = 'ok' | 'retry' | 'fail';

export interface SagaActionContext {
  tenantId: string;
  companyId: string;
  sagaKey: string;
  instanceId: string;
  /** plan step id. */
  stepId: string;
  /** The step ROW id — the idempotency key for the action. */
  idempotencyKey: string;
  correlationKey: string;
  input: Record<string, unknown>;
}

export interface SagaActionResult {
  outcome: SagaActionOutcome;
  output?: Record<string, unknown>;
  error?: string;
}

export interface SagaUndoContext extends SagaActionContext {
  /** Output produced by the matching DO step, if any. */
  doOutput?: Record<string, unknown>;
}

export interface SagaUndoResult {
  outcome: SagaActionOutcome;
  error?: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ISagaConfig {
  /** Worker lease in seconds (design: 60s). */
  workerLeaseSeconds: number;
  /** Step claim batch size. */
  claimBatchSize: number;
  /** Max rows claimed per company per batch (fairness). */
  fairnessCap: number;
  /** Sweep interval for WAIT timeouts + stale leases (ms). */
  sweepIntervalMs: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  defaultMaxAttempts: number;
  /** Purge inbox rows older than this many days. */
  inboxRetentionDays: number;
}
