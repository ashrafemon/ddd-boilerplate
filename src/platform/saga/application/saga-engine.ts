import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { SagaEmittedEvent } from '../events/saga-emitted.event';
import {
  InsertInstanceInput,
  SagaInboxRepository,
  SagaInstanceRepository,
  SagaStepRepository,
} from '../repositories/prisma-saga.repository';
import {
  SagaInstanceReason,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaPlanStep,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from '../saga.types';
import { evaluateCondition, evaluateExpression, parseDuration, renderTemplate } from './expression';

const TERMINAL_STATUSES: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.COMPLETED,
  SagaInstanceStatus.COMPENSATED,
  SagaInstanceStatus.CANCELLED,
  SagaInstanceStatus.FAILED_MANUAL,
]);

/** Expression scope: the frozen context plus the step execution log. */
interface SagaScope {
  [key: string]: unknown;
  event: Record<string, unknown>;
  saga: Record<string, unknown>;
  company: { settings: Record<string, unknown> };
  steps: Record<string, { status: string; output: Record<string, unknown> }>;
}

function buildScope(instance: SagaInstanceRecord, stepRows: SagaStepRecord[]): SagaScope {
  const context = instance.context ?? {};
  const steps: SagaScope['steps'] = {};
  for (const row of stepRows) {
    steps[row.stepId] = { status: row.status, output: row.output ?? {} };
  }
  const sagaData = (context.start as Record<string, unknown> | undefined) ?? {};
  return {
    event: (context.event as Record<string, unknown> | undefined) ?? {},
    saga: { ...sagaData, key: instance.correlationKey, correlationKey: instance.correlationKey },
    company: { settings: (context.settings as Record<string, unknown> | undefined) ?? {} },
    steps,
  };
}

/** Resolve a step's `input` expressions against the scope. */
function buildInput(
  step: SagaPlanStep,
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

/**
 * SagaEngine — the saga's state machine.
 *
 * `advance` walks the frozen plan from the cursor: it bypasses steps whose `if`
 * is false, consumes a buffered event for a WAIT step, or hands the next DO
 * step to the durable `saga_steps` queue and stops. On a business failure it
 * compensates the completed DO steps in reverse. It reads/writes repository
 * rows only — business work happens inside `SagaAction`s via the step worker.
 */
@Injectable()
export class SagaEngine {
  private readonly logger = new Logger(SagaEngine.name);

  constructor(
    private readonly instances: SagaInstanceRepository,
    private readonly steps: SagaStepRepository,
    private readonly inbox: SagaInboxRepository,
    private readonly outbox: OutboxWriterPort,
    private readonly configService: ConfigService,
  ) {}

  /** Insert the live instance (deduped on the correlation key) and advance it. */
  async createAndAdvance(input: InsertInstanceInput): Promise<SagaInstanceRecord | null> {
    const instance = await this.instances.tryInsertLive(input);
    if (!instance) {
      return null;
    }
    return this.advance(instance.id);
  }

  async advance(instanceId: string): Promise<SagaInstanceRecord | null> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return instance;
    }
    if (instance.status === SagaInstanceStatus.COMPENSATING) {
      return instance;
    }

    const plan = instance.plan;
    const scope = buildScope(instance, await this.steps.findByInstance(instance.id));
    const now = new Date();
    let cursor = instance.cursor;

    while (cursor < plan.steps.length) {
      const step = plan.steps[cursor];

      if (step.if && !evaluateCondition(step.if, scope)) {
        await this.recordBypass(instance, step, now);
        cursor += 1;
        continue;
      }

      if (step.kind === SagaStepKind.WAIT) {
        const consumed = await this.consumeWait(instance, step, scope, now);
        if (consumed) {
          scope.steps[step.id] = { status: SagaStepStatus.DONE, output: { eventId: consumed } };
          cursor += 1;
          continue;
        }
        const timeoutMs = step.timeout
          ? parseDuration(step.timeout)
          : this.configService.getSaga().workerLeaseSeconds * 1000;
        await this.steps.createIfAbsent({
          tenantId: instance.tenantId,
          companyId: instance.companyId,
          instanceId: instance.id,
          stepId: step.id,
          kind: SagaStepKind.WAIT,
          action: null,
          status: SagaStepStatus.PENDING,
          maxAttempts: step.maxAttempts,
          runAt: new Date(now.getTime() + timeoutMs),
        });
        return this.instances.updateCas(instance.id, instance.version, {
          cursor,
          status: SagaInstanceStatus.WAITING,
          waitingEvent: `${step.waitFor?.name}@${step.waitFor?.version}`,
        });
      }

      const input = buildInput(step, scope);
      const created = await this.steps.createIfAbsent({
        tenantId: instance.tenantId,
        companyId: instance.companyId,
        instanceId: instance.id,
        stepId: step.id,
        kind: SagaStepKind.DO,
        action: step.action ?? null,
        status: SagaStepStatus.PENDING,
        maxAttempts: step.maxAttempts,
        runAt: now,
        input,
      });
      if (created.status === SagaStepStatus.DONE) {
        scope.steps[step.id] = { status: SagaStepStatus.DONE, output: created.output ?? {} };
        cursor += 1;
        continue;
      }
      if (created.status === SagaStepStatus.SKIPPED) {
        cursor += 1;
        continue;
      }
      // Hand the durable DO step to the worker.
      return this.instances.updateCas(instance.id, instance.version, {
        cursor,
        status: SagaInstanceStatus.RUNNING,
        waitingEvent: null,
      });
    }

    return this.complete(instance, cursor);
  }

  /** Worker hook: a DO step finished with `ok`. */
  async onDoSucceeded(instanceId: string, stepId: string): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return;
    }
    const index = instance.plan.steps.findIndex(step => step.id === stepId);
    if (index === -1) {
      return;
    }
    await this.instances.updateCas(instance.id, instance.version, { cursor: index + 1 });
    await this.advance(instance.id);
  }

  /** Worker hook: a DO step exhausted its retries / returned `fail`. */
  async onDoFailed(
    instanceId: string,
    stepId: string,
    error: string,
    reason: SagaInstanceReason = SagaInstanceReason.STEP_FAILED,
  ): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return;
    }
    const index = instance.plan.steps.findIndex(step => step.id === stepId);
    if (index === -1) {
      return;
    }
    await this.startCompensation(instance, index, reason, error);
  }

  /** Worker hook: an UNDO step finished with `ok`. */
  async onUndoSucceeded(instanceId: string, stepId: string): Promise<void> {
    void stepId;
    const instance = await this.instances.findById(instanceId);
    if (!instance || instance.status !== SagaInstanceStatus.COMPENSATING) {
      return;
    }
    const rows = await this.steps.findByInstance(instance.id);
    const pendingUndo = rows.some(
      row =>
        row.kind === SagaStepKind.UNDO &&
        (row.status === SagaStepStatus.PENDING || row.status === SagaStepStatus.RUNNING),
    );
    if (pendingUndo) {
      return;
    }
    await this.instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.COMPENSATED,
      error: failedUndoError(rows) ?? instance.error,
    });
  }

  /** Worker hook: an UNDO step exhausted its retries — needs a human. */
  async onUndoFailed(instanceId: string, stepId: string, error: string): Promise<void> {
    void stepId;
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return;
    }
    await this.instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.FAILED_MANUAL,
      error,
    });
  }

  /** Sweep hook: a WAIT step's timeout instant passed with no matching event. */
  async onWaitTimeout(stepRow: SagaStepRecord): Promise<void> {
    const instance = await this.instances.findById(stepRow.instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return;
    }
    const planStep = instance.plan.steps.find(step => step.id === stepRow.stepId);
    await this.steps.markFailed(stepRow.id, `WAIT step "${stepRow.stepId}" timed out`);

    if (planStep?.onTimeout === 'compensate') {
      const index = instance.plan.steps.findIndex(step => step.id === stepRow.stepId);
      await this.startCompensation(
        instance,
        index === -1 ? instance.cursor : index,
        SagaInstanceReason.TIMEOUT,
        `WAIT step "${stepRow.stepId}" timed out`,
      );
      return;
    }

    // Default: skip the wait and keep going (bypass means continue, never wait).
    const index = instance.plan.steps.findIndex(step => step.id === stepRow.stepId);
    await this.instances.updateCas(instance.id, instance.version, {
      cursor: index === -1 ? instance.cursor : index + 1,
      waitingEvent: null,
      status: SagaInstanceStatus.RUNNING,
    });
    await this.advance(instance.id);
  }

  /** Router hook: a cancel event (or a user cancel) arrived. */
  async cancel(instanceId: string, reason: SagaInstanceReason): Promise<void> {
    const instance = await this.instances.findById(instanceId);
    if (!instance || TERMINAL_STATUSES.has(instance.status)) {
      return;
    }
    const rows = await this.steps.findByInstance(instance.id);
    const hasCompletedDo = rows.some(
      row => row.kind === SagaStepKind.DO && row.status === SagaStepStatus.DONE,
    );
    if (!hasCompletedDo) {
      await this.instances.updateCas(instance.id, instance.version, {
        status: SagaInstanceStatus.CANCELLED,
        reason,
      });
      return;
    }
    await this.startCompensation(instance, instance.cursor, reason, `Cancelled: ${reason}`);
  }

  /** Router hook: buffer an event for a live instance (deduped) and advance it. */
  async bufferForInstance(
    instance: SagaInstanceRecord,
    eventId: string,
    eventName: string,
    eventVersion: number,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const inserted = await this.inbox.tryInsert({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      consumer: `${instance.sagaKey}:${instance.id}`,
      eventId,
      eventName,
      eventVersion,
      correlationKey: instance.correlationKey,
      instanceId: instance.id,
      payload,
    });
    if (!inserted) {
      return false;
    }
    await this.inbox.markBuffered(inserted.id, instance.correlationKey, instance.id);
    await this.advance(instance.id);
    return true;
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async recordBypass(
    instance: SagaInstanceRecord,
    step: SagaPlanStep,
    now: Date,
  ): Promise<void> {
    await this.steps.createIfAbsent({
      tenantId: instance.tenantId,
      companyId: instance.companyId,
      instanceId: instance.id,
      stepId: step.id,
      kind: step.kind === SagaStepKind.WAIT ? SagaStepKind.WAIT : SagaStepKind.DO,
      action: step.action ?? null,
      status: SagaStepStatus.SKIPPED,
      maxAttempts: step.maxAttempts,
      runAt: now,
    });
  }

  private async consumeWait(
    instance: SagaInstanceRecord,
    step: SagaPlanStep,
    scope: Record<string, unknown>,
    now: Date,
  ): Promise<string | null> {
    if (!step.waitFor) {
      return null;
    }
    const buffered = await this.inbox.listBuffered(
      instance.id,
      step.waitFor.name,
      step.waitFor.version,
      50,
    );
    for (const row of buffered) {
      const eventScope = { ...scope, event: row.payload };
      if (step.match && renderTemplate(step.match, eventScope) !== instance.correlationKey) {
        continue;
      }
      if (step.when && !evaluateCondition(step.when, eventScope)) {
        continue;
      }
      await this.steps.createIfAbsent({
        tenantId: instance.tenantId,
        companyId: instance.companyId,
        instanceId: instance.id,
        stepId: step.id,
        kind: SagaStepKind.WAIT,
        action: null,
        status: SagaStepStatus.DONE,
        maxAttempts: step.maxAttempts,
        runAt: now,
        output: { eventId: row.eventId },
      });
      await this.inbox.markConsumed(row.id);
      return row.eventId;
    }
    return null;
  }

  private async complete(
    instance: SagaInstanceRecord,
    cursor: number,
  ): Promise<SagaInstanceRecord | null> {
    const updated = await this.instances.updateCas(instance.id, instance.version, {
      status: SagaInstanceStatus.COMPLETED,
      cursor,
      waitingEvent: null,
    });
    if (updated && instance.plan.onComplete) {
      await this.outbox.append(
        new SagaEmittedEvent(instance.plan.onComplete.emit, {
          sagaKey: instance.sagaKey,
          instanceId: instance.id,
          correlationKey: instance.correlationKey,
        }),
        'Saga',
        instance.id,
      );
    }
    return updated;
  }

  private async startCompensation(
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
        error: `${error} — past the pivot step, no compensation possible`,
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
          error: `Step "${step.id}" completed with no undo (and is not a pivot) — manual reversal required`,
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
      error,
      waitingEvent: null,
    });
  }
}

function failedUndoError(rows: SagaStepRecord[]): string | null {
  const failed = rows.find(
    row => row.kind === SagaStepKind.UNDO && row.status === SagaStepStatus.FAILED,
  );
  return failed?.error ?? null;
}
