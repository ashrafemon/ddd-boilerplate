/**
 * Saga types — statuses, the definition/overlay/plan shapes, port data and the
 * `ISagaConfig` shape. Design 08: linear steps, three small expressions, a safe
 * evaluator, defaults + company overlays that only narrow.
 *
 * Persisted records mirror the workbook tables (`saga_definitions`,
 * `saga_instances`, `saga_steps`, `saga_outbox`, `saga_inbox`); field names are
 * the contract names, the repository maps the snake_case columns at its edge.
 * `saga_company_overlays` is deliberately not implemented — plans come from the
 * platform definition only, so `SagaOverlay` survives as a pure seam the plan
 * builder accepts but no runtime source feeds.
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
  /**
   * Published, but the runtime integrity check found it cannot execute (a
   * condition no longer parses, an action is no longer registered). No new
   * instances start — the router only reads ACTIVE — existing instances finish
   * on their snapshot (workbook `8-Saga` flow 9, `CONFIG_INVALID`).
   */
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
  /** Owning business module (`purchase-order`); null for platform defaults. */
  ownerModule: string | null;
  sagaKey: string;
  version: number;
  eventName: string;
  eventVersion: number;
  status: SagaDefinitionStatus;
  definition: SagaDefinitionBody;
  createdAt: Date;
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
  lastError: string | null;
  deadlineAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  version: number;
}

export interface SagaStepRecord {
  id: string;
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: SagaStepKind;
  /** Registered action name for DO/UNDO rows. */
  action: string | null;
  /** Event contract a WAIT row parks on. */
  eventName: string | null;
  eventVersion: number | null;
  status: SagaStepStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedBy: string | null;
  lockUntil: Date | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  lastError: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
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
  /** Max rows examined per sweep pass (WAIT expiry + stale-lease reclaim). */
  sweepBatchSize: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  defaultMaxAttempts: number;
  /** Purge inbox rows older than this many days. */
  inboxRetentionDays: number;
  /** Dispatch tick for the saga's own outbox ledger (`saga_outbox`). */
  outboxPollIntervalMs: number;
}

export interface SagaScope extends Record<string, unknown> {
  event: Record<string, unknown>;
  saga: Record<string, unknown> & { key: string; correlationKey: string };
  company: { settings: Record<string, unknown> };
  steps: Record<string, { status: SagaStepStatus; output: Record<string, unknown> }>;
}
