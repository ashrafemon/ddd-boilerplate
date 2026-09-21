/**
 * Saga types — identity, status, requests, definitions, configuration.
 */

// ─── Status ──────────────────────────────────────────────────────────

export enum SagaStatus {
  STARTED = 'STARTED',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
}

export enum SagaStepStatus {
  PENDING = 'PENDING',
  CLAIMED = 'CLAIMED',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  SUSPENDED = 'SUSPENDED',
}

// ─── Definition ──────────────────────────────────────────────────────

export interface SagaStepDefinition {
  name: string;
  commandType: string;
  commandVersion?: number;
  waitFor: string[];
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface SagaCompensationDefinition {
  on: string; // failed step name
  commandType: string;
  commandVersion?: number;
}

export interface SagaDefinition {
  type: string;
  version: number;
  start: {
    eventType: string;
    eventVersion?: number;
  };
  steps: SagaStepDefinition[];
  compensation?: SagaCompensationDefinition[];
}

// ─── Instance ────────────────────────────────────────────────────────

export interface SagaInstance {
  id: string;
  tenantId: string;
  organizationId: string;
  sagaType: string;
  sagaVersion: number;
  correlationId: string;
  status: SagaStatus;
  currentStep: string | null;
  state: unknown;
  startedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  claimToken: string | null;
  claimedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaStepExecution {
  id: string;
  sagaInstanceId: string;
  stepName: string;
  status: SagaStepStatus;
  attempts: number;
  commandId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  availableAt: Date | null;
  lastError: string | null;
  claimToken: string | null;
  claimedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Requests ────────────────────────────────────────────────────────

export interface StartSagaRequest {
  tenantId: string;
  organizationId: string;
  sagaType: string;
  sagaVersion?: number;
  correlationId?: string;
  triggerEvent: {
    eventType: string;
    eventVersion?: number;
    eventId?: string;
    payload: unknown;
  };
}

export interface HandleSagaEventRequest {
  tenantId: string;
  organizationId: string;
  sagaType: string;
  correlationId: string;
  event: {
    eventType: string;
    eventVersion?: number;
    eventId?: string;
    payload: unknown;
  };
}

export interface SuspendSagaRequest {
  tenantId: string;
  organizationId: string;
  sagaInstanceId: string;
  claimToken: string;
  reason?: string;
}

export interface CompensateSagaRequest {
  tenantId: string;
  organizationId: string;
  sagaInstanceId: string;
  claimToken: string;
  failedStep: string;
}

export interface SagaCommandDispatchRequest {
  tenantId: string;
  organizationId: string;
  commandId: string;
  commandType: string;
  commandVersion?: number;
  payload: unknown;
  correlationId: string;
  causationId?: string;
}

export interface SagaCommandDispatchResult {
  success: boolean;
  error?: string;
}

// ─── Configuration ───────────────────────────────────────────────────

export interface SagaCompanyConfig {
  id: string;
  tenantId: string;
  organizationId: string;
  sagaType: string;
  sagaVersion: number;
  enabled: boolean;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaEventSubscription {
  id: string;
  tenantId: string;
  organizationId: string;
  sagaType: string;
  eventType: string;
  eventVersion: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaStepConfig {
  id: string;
  tenantId: string;
  organizationId: string;
  sagaType: string;
  stepName: string;
  enabled: boolean;
  timeoutMs: number | null;
  maxAttempts: number | null;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SagaCompensationConfig {
  id: string;
  tenantId: string;
  organizationId: string;
  sagaType: string;
  failedStep: string;
  compensationStep: string;
  order: number;
  enabled: boolean;
  configJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Claims ──────────────────────────────────────────────────────────

export interface ClaimSagaOptions {
  batchSize: number;
}

// ─── Configuration ───────────────────────────────────────────────────

export interface ISagaConfig {
  defaultTimeoutMs: number;
  defaultMaxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  reconciliationIntervalMs: number;
  stepClaimLeaseMs: number;
  maxConcurrentInstances: number;
  maxConcurrentSteps: number;
}
