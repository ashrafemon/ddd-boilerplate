import { SagaStepKind, SagaStepRecord, SagaStepStatus } from '../../types/saga.types';

/** Values needed to enqueue one durable step (unique per instance/step/kind). */
export interface InsertStepInput {
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: SagaStepKind;
  /** Registered action name; WAIT rows have none. */
  action?: string | null;
  eventName?: string | null;
  eventVersion?: number | null;
  status?: SagaStepStatus;
  maxAttempts: number;
  runAt: Date;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
}

export interface ClaimStepsInput {
  now: Date;
  leaseMs: number;
  batchSize: number;
  workerId: string;
  fairnessCap: number;
}

/**
 * Outbound port: the `saga_steps` table — durable work queue, execution log and
 * audit trail in one row (`id` doubles as the action's idempotency key).
 *
 * Claims are `FOR UPDATE SKIP LOCKED` leases, so a crashed worker's rows are
 * picked up by the next tick once `lock_until` passes; every settle is a CAS on
 * status.
 */
export abstract class SagaStepRepositoryPort {
  abstract createIfAbsent(input: InsertStepInput): Promise<SagaStepRecord>;

  abstract findById(id: string): Promise<SagaStepRecord | null>;

  abstract findByInstance(instanceId: string): Promise<SagaStepRecord[]>;

  abstract claimBatch(input: ClaimStepsInput): Promise<SagaStepRecord[]>;

  abstract markDone(id: string, output: Record<string, unknown> | null): Promise<void>;

  abstract markSkipped(id: string): Promise<void>;

  abstract markFailed(id: string, error: string): Promise<void>;

  abstract reschedule(
    id: string,
    attempts: number,
    runAt: Date,
    error: string | null,
  ): Promise<void>;

  /** PENDING WAIT rows whose timeout instant has passed. */
  abstract findExpiredWaits(now: Date, limit: number): Promise<SagaStepRecord[]>;

  /** RUNNING rows whose lease expired (crashed worker). */
  abstract findStaleRunning(now: Date, limit: number): Promise<SagaStepRecord[]>;
}
