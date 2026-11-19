import { Injectable } from '@nestjs/common';
import {
  SagaInstanceReason,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from '../types/saga.types';
import { buildInput, buildScope } from '../types/saga-scope';
import { PrismaSagaInstanceRepository } from '../repositories/prisma-saga-instance.repository';
import { PrismaSagaStepRepository } from '../repositories/prisma-saga-step.repository';

/**
 * Use case: reverse a partially executed saga.
 *
 * Walks the completed DO steps backwards and enqueues an UNDO row per step. Two
 * guard rails: past the pivot step the saga only moves forward (`FAILED_MANUAL`),
 * and a completed step without an `undo` is a manual reversal, never a silent
 * skip. WAIT steps have nothing to reverse.
 */
@Injectable()
export class StartCompensationUseCase {
  constructor(
    private readonly instances: PrismaSagaInstanceRepository,
    private readonly steps: PrismaSagaStepRepository,
  ) {}

  async execute(
    instance: SagaInstanceRecord,
    failedIndex: number,
    reason: SagaInstanceReason,
    error: string,
  ): Promise<SagaInstanceRecord | null> {
    const plan = instance.plan;
    const pivotIndex = plan.steps.findIndex(step => step.pivot);
    if (pivotIndex !== -1 && failedIndex > pivotIndex) {
      return this.instances.updateCas(instance.id, instance.version, {
        status: SagaInstanceStatus.FAILED_MANUAL,
        reason,
        lastError: `${error} — past the pivot step, no compensation possible`,
      });
    }

    const rows = await this.steps.findByInstance(instance.id);
    const scope = buildScope(instance, rows);
    const now = new Date();

    for (let index = failedIndex - 1; index >= 0; index -= 1) {
      const step = plan.steps[index];
      if (step.kind !== SagaStepKind.DO) {
        continue;
      }
      const row = rows.find(
        candidate => candidate.stepId === step.id && candidate.kind === SagaStepKind.DO,
      );
      if (!row || row.status !== SagaStepStatus.DONE) {
        continue;
      }
      if (!step.undo) {
        return this.instances.updateCas(instance.id, instance.version, {
          status: SagaInstanceStatus.FAILED_MANUAL,
          reason,
          lastError: `Step "${step.id}" completed with no undo (and is not a pivot) — manual reversal required`,
        });
      }
      await this.steps.createIfAbsent({
        tenantId: instance.tenantId,
        companyId: instance.companyId,
        instanceId: instance.id,
        stepId: step.id,
        kind: SagaStepKind.UNDO,
        action: step.undo,
        status: SagaStepStatus.PENDING,
        maxAttempts: step.maxAttempts,
        runAt: now,
        input: { ...(row.output ?? {}), ...(buildInput(step, scope) ?? {}) },
      });
    }

    return this.instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.COMPENSATING,
      reason,
      lastError: error,
      waitingEvent: null,
    });
  }
}

/** Shared guard: the instance is live (not terminal). */
export function isTerminal(instance: SagaInstanceRecord): boolean {
  return (
    instance.status === SagaInstanceStatus.COMPLETED ||
    instance.status === SagaInstanceStatus.COMPENSATED ||
    instance.status === SagaInstanceStatus.CANCELLED ||
    instance.status === SagaInstanceStatus.FAILED_MANUAL
  );
}

/** Shared guard: any UNDO row still waiting for its turn. */
export function hasPendingUndo(rows: SagaStepRecord[]): boolean {
  return rows.some(
    row =>
      row.kind === SagaStepKind.UNDO &&
      (row.status === SagaStepStatus.PENDING || row.status === SagaStepStatus.RUNNING),
  );
}
