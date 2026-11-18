import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../../../../generated/client';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import { SagaStepKind, SagaStepRecord, SagaStepStatus } from '../../types/saga.types';
import {
  ClaimStepsInput,
  InsertStepInput,
  SagaStepRepositoryPort,
} from '../ports/saga-step.repository.port';

const UNIQUE_VIOLATION = 'P2002';

const jsonOrNull = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === null || value === undefined ? undefined : PrismaJson.toInput(value);

interface StepRow {
  id: string;
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: string;
  action: string | null;
  eventName: string | null;
  eventVersion: number | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedBy: string | null;
  lockUntil: Date | null;
  input: unknown;
  output: unknown;
  lastError: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * PostgreSQL adapter for `saga_steps`.
 *
 * Claims are `FOR UPDATE SKIP LOCKED` leases stamped with `locked_by` /
 * `lock_until`: a crashed worker's rows are simply reclaimed once the lease
 * expires, so no reconciler is needed. Physical columns are snake_case.
 */
@Injectable()
export class PrismaSagaStepRepository implements SagaStepRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  /** Unique (instance, step, kind) — a duplicate returns the existing row. */
  async createIfAbsent(input: InsertStepInput): Promise<SagaStepRecord> {
    const existing = await this.findByInstanceStep(input.instanceId, input.stepId, input.kind);
    if (existing) {
      return existing;
    }
    try {
      const row = await this.txHost.tx.sagaStep.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          companyId: input.companyId,
          instanceId: input.instanceId,
          stepId: input.stepId,
          kind: input.kind,
          action: input.action ?? null,
          eventName: input.eventName ?? null,
          eventVersion: input.eventVersion ?? null,
          status: input.status ?? SagaStepStatus.PENDING,
          maxAttempts: input.maxAttempts,
          runAt: input.runAt,
          input: jsonOrNull(input.input),
          output: jsonOrNull(input.output),
          ...(input.status === SagaStepStatus.DONE ? { finishedAt: new Date() } : {}),
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
        const row = await this.findByInstanceStep(input.instanceId, input.stepId, input.kind);
        if (row) {
          return row;
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<SagaStepRecord | null> {
    const row = await this.txHost.tx.sagaStep.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByInstance(instanceId: string): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => this.toRecord(row));
  }

  async findByInstanceStep(
    instanceId: string,
    stepId: string,
    kind: SagaStepKind,
  ): Promise<SagaStepRecord | null> {
    const row = await this.txHost.tx.sagaStep.findUnique({
      where: { instanceId_stepId_kind: { instanceId, stepId, kind } },
    });
    return row ? this.toRecord(row) : null;
  }

  /**
   * Claim due PENDING rows: SKIP LOCKED + lease. A fairness cap keeps one
   * company from starving the batch (overflow rows are released immediately).
   *
   * `RETURNING` aliases every snake_case column: `$queryRaw` returns physical
   * names, so an un-aliased `RETURNING *` would hand the mapper `locked_by` and
   * undefined camelCase fields (a fairness cap would then bucket every row under
   * `undefined` and misfire).
   */
  async claimBatch(input: ClaimStepsInput): Promise<SagaStepRecord[]> {
    const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
    const rows = await this.txHost.tx.$queryRaw<StepRow[]>`
      UPDATE "saga_steps" s
      SET "status" = 'RUNNING',
          "locked_by" = ${input.workerId},
          "lock_until" = ${leaseUntil},
          "started_at" = COALESCE(s."started_at", ${input.now}),
          "updated_at" = now()
      WHERE s."id" IN (
        SELECT "id" FROM "saga_steps"
        WHERE "status" = 'PENDING'
          AND "kind" IN ('DO', 'UNDO')
          AND "run_at" <= ${input.now}
          AND ("lock_until" IS NULL OR "lock_until" < ${input.now})
        ORDER BY "run_at" ASC
        LIMIT ${input.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id",
                "tenant_id" AS "tenantId",
                "company_id" AS "companyId",
                "instance_id" AS "instanceId",
                "step_id" AS "stepId",
                "kind",
                "action",
                "event_name" AS "eventName",
                "event_version" AS "eventVersion",
                "status",
                "attempts",
                "max_attempts" AS "maxAttempts",
                "run_at" AS "runAt",
                "locked_by" AS "lockedBy",
                "lock_until" AS "lockUntil",
                "input",
                "output",
                "last_error" AS "lastError",
                "started_at" AS "startedAt",
                "finished_at" AS "finishedAt"`;

    const { claimed, overflow } = this.applyFairnessCap(rows, input.fairnessCap);
    if (overflow.length > 0) {
      await this.txHost.tx.sagaStep.updateMany({
        where: { id: { in: overflow.map(row => row.id) } },
        data: { status: SagaStepStatus.PENDING, lockedBy: null, lockUntil: null },
      });
    }
    return claimed.map(row => this.toRecord(row));
  }

  async markDone(id: string, output: Record<string, unknown> | null): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id, status: SagaStepStatus.RUNNING },
      data: {
        status: SagaStepStatus.DONE,
        output: jsonOrNull(output),
        lockedBy: null,
        lockUntil: null,
        finishedAt: new Date(),
      },
    });
  }

  async markSkipped(id: string): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id, status: { in: [SagaStepStatus.PENDING, SagaStepStatus.RUNNING] } },
      data: {
        status: SagaStepStatus.SKIPPED,
        lockedBy: null,
        lockUntil: null,
        finishedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id, status: SagaStepStatus.RUNNING },
      data: {
        status: SagaStepStatus.FAILED,
        lastError: error,
        lockedBy: null,
        lockUntil: null,
        finishedAt: new Date(),
      },
    });
  }

  async reschedule(id: string, attempts: number, runAt: Date, error: string | null): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id },
      data: {
        status: SagaStepStatus.PENDING,
        attempts,
        runAt,
        lastError: error,
        lockedBy: null,
        lockUntil: null,
      },
    });
  }

  async findExpiredWaits(now: Date, limit: number): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { kind: SagaStepKind.WAIT, status: SagaStepStatus.PENDING, runAt: { lte: now } },
      orderBy: { runAt: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row));
  }

  async findStaleRunning(now: Date, limit: number): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { status: SagaStepStatus.RUNNING, lockUntil: { lt: now } },
      orderBy: { lockUntil: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row));
  }

  private applyFairnessCap(
    rows: StepRow[],
    fairnessCap: number,
  ): { claimed: StepRow[]; overflow: StepRow[] } {
    if (fairnessCap <= 0) {
      return { claimed: rows, overflow: [] };
    }
    const perCompany = new Map<string, number>();
    const claimed: StepRow[] = [];
    const overflow: StepRow[] = [];
    for (const row of rows) {
      const count = perCompany.get(row.companyId) ?? 0;
      if (count >= fairnessCap) {
        overflow.push(row);
        continue;
      }
      perCompany.set(row.companyId, count + 1);
      claimed.push(row);
    }
    return { claimed, overflow };
  }

  private toRecord(row: StepRow): SagaStepRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      instanceId: row.instanceId,
      stepId: row.stepId,
      kind: row.kind as SagaStepKind,
      action: row.action,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      status: row.status as SagaStepStatus,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      runAt: row.runAt,
      lockedBy: row.lockedBy,
      lockUntil: row.lockUntil,
      input: (row.input as Record<string, unknown> | null) ?? null,
      output: (row.output as Record<string, unknown> | null) ?? null,
      lastError: row.lastError,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    };
  }
}
