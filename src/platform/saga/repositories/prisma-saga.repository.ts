import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../generated/client';
import { PrismaJson } from '@shared-kernel/utils/prisma-json.util';
import {
  SagaCompanyConfigRecord,
  SagaCompanyConfigStatus,
  SagaDefinitionBody,
  SagaDefinitionRecord,
  SagaDefinitionStatus,
  SagaInboxRecord,
  SagaInboxStatus,
  SagaInstanceReason,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaOverlay,
  SagaPlan,
  SagaStepKind,
  SagaStepRecord,
  SagaStepStatus,
} from '../saga.types';

const UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION;
}

const json = (value: unknown): Prisma.InputJsonValue =>
  PrismaJson.toInput(value as object) as Prisma.InputJsonValue;
const jsonOrNull = (value: unknown): Prisma.InputJsonValue | undefined =>
  value === null || value === undefined ? undefined : json(value);

// ─── saga_definitions ───────────────────────────────────────────────────────

interface DefinitionRaw {
  id: string;
  sagaKey: string;
  version: number;
  eventName: string;
  eventVersion: number;
  status: string;
  definition: unknown;
  createdAt: Date;
}

@Injectable()
export class SagaDefinitionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async findActiveByEvent(
    eventName: string,
    eventVersion: number,
  ): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findFirst({
      where: { eventName, eventVersion, status: SagaDefinitionStatus.ACTIVE },
      orderBy: { version: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findActiveByKey(sagaKey: string): Promise<SagaDefinitionRecord | null> {
    const row = await this.txHost.tx.sagaDefinition.findFirst({
      where: { sagaKey, status: SagaDefinitionStatus.ACTIVE },
    });
    return row ? this.toRecord(row) : null;
  }

  /** All ACTIVE definitions — bounded set, filtered in memory by the router. */
  async listActive(): Promise<SagaDefinitionRecord[]> {
    const rows = await this.txHost.tx.sagaDefinition.findMany({
      where: { status: SagaDefinitionStatus.ACTIVE },
      orderBy: { sagaKey: 'asc' },
    });
    return rows.map(row => this.toRecord(row as DefinitionRaw));
  }

  async create(input: {
    sagaKey: string;
    status: SagaDefinitionStatus;
    definition: SagaDefinitionBody;
    createdBy?: string;
  }): Promise<SagaDefinitionRecord> {
    const row = await this.txHost.tx.sagaDefinition.create({
      data: {
        sagaKey: input.sagaKey,
        version: input.definition.version,
        eventName: input.definition.start.event.name,
        eventVersion: input.definition.start.event.version,
        status: input.status,
        definition: json(input.definition),
        createdBy: input.createdBy,
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: DefinitionRaw): SagaDefinitionRecord {
    return {
      id: row.id,
      sagaKey: row.sagaKey,
      version: row.version,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      status: row.status as SagaDefinitionStatus,
      definition: row.definition as SagaDefinitionBody,
      createdAt: row.createdAt,
    };
  }
}

// ─── saga_company_configs ───────────────────────────────────────────────────

interface ConfigRaw {
  id: string;
  tenantId: string;
  companyId: string;
  definitionId: string;
  sagaKey: string;
  baseVersion: number;
  overlay: unknown;
  status: string;
}

@Injectable()
export class SagaCompanyConfigRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async findActive(
    tenantId: string,
    companyId: string,
    sagaKey: string,
  ): Promise<SagaCompanyConfigRecord | null> {
    const row = await this.txHost.tx.sagaCompanyConfig.findFirst({
      where: { tenantId, companyId, sagaKey, status: SagaCompanyConfigStatus.ACTIVE },
    });
    return row ? this.toRecord(row) : null;
  }

  /** Re-validation: park an overlay as INVALID so the default applies + alert. */
  async markInvalid(id: string): Promise<void> {
    await this.txHost.tx.sagaCompanyConfig.updateMany({
      where: { id, status: SagaCompanyConfigStatus.ACTIVE },
      data: { status: SagaCompanyConfigStatus.INVALID },
    });
  }

  private toRecord(row: ConfigRaw): SagaCompanyConfigRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      definitionId: row.definitionId,
      sagaKey: row.sagaKey,
      baseVersion: row.baseVersion,
      overlay: row.overlay as SagaOverlay,
      status: row.status as SagaCompanyConfigStatus,
    };
  }
}

// ─── saga_instances ─────────────────────────────────────────────────────────

interface InstanceRaw {
  id: string;
  tenantId: string;
  companyId: string;
  sagaKey: string;
  definitionId: string;
  configId: string | null;
  rootRefType: string | null;
  rootRefId: string | null;
  correlationKey: string;
  status: string;
  reason: string | null;
  plan: unknown;
  context: unknown;
  cursor: number;
  waitingEvent: string | null;
  cancelRequestedAt: Date | null;
  error: string | null;
  deadlineAt: Date | null;
  version: number;
}

export interface InsertInstanceInput {
  tenantId: string;
  companyId: string;
  sagaKey: string;
  definitionId: string;
  configId: string | null;
  rootRefType: string | null;
  rootRefId: string | null;
  correlationKey: string;
  plan: SagaPlan;
  context: Record<string, unknown>;
  deadlineAt: Date | null;
}

@Injectable()
export class SagaInstanceRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  /** Insert on the partial unique key; a duplicate means a live instance exists. */
  async tryInsertLive(input: InsertInstanceInput): Promise<SagaInstanceRecord | null> {
    try {
      const row = await this.txHost.tx.sagaInstance.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          companyId: input.companyId,
          sagaKey: input.sagaKey,
          definitionId: input.definitionId,
          configId: input.configId,
          rootRefType: input.rootRefType,
          rootRefId: input.rootRefId,
          correlationKey: input.correlationKey,
          status: SagaInstanceStatus.RUNNING,
          plan: json(input.plan),
          context: json(input.context),
          cursor: 0,
          deadlineAt: input.deadlineAt,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }
  }

  async findById(id: string): Promise<SagaInstanceRecord | null> {
    const row = await this.txHost.tx.sagaInstance.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByCorrelation(
    sagaKey: string,
    correlationKey: string,
  ): Promise<SagaInstanceRecord | null> {
    const row = await this.txHost.tx.sagaInstance.findFirst({
      where: { sagaKey, correlationKey, status: SagaInstanceStatus.WAITING },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toRecord(row) : null;
  }

  async findLiveByKey(sagaKey: string, correlationKey: string): Promise<SagaInstanceRecord[]> {
    const rows = await this.txHost.tx.sagaInstance.findMany({
      where: {
        sagaKey,
        correlationKey,
        status: { in: [SagaInstanceStatus.RUNNING, SagaInstanceStatus.WAITING] },
      },
    });
    return rows.map(row => this.toRecord(row as InstanceRaw));
  }

  /** Live instances parked on a WAIT step for `eventName@eventVersion`. */
  async findWaitingByEvent(
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInstanceRecord[]> {
    const rows = await this.txHost.tx.sagaInstance.findMany({
      where: {
        status: SagaInstanceStatus.WAITING,
        waitingEvent: `${eventName}@${eventVersion}`,
      },
      take: limit,
    });
    return rows.map(row => this.toRecord(row as InstanceRaw));
  }

  /** CAS write fenced on `version`; returns the reloaded row or null on race. */
  async updateCas(
    id: string,
    expectedVersion: number,
    patch: Partial<{
      status: SagaInstanceStatus;
      reason: SagaInstanceReason | null;
      cursor: number;
      waitingEvent: string | null;
      cancelRequestedAt: Date | null;
      error: string | null;
      deadlineAt: Date | null;
      context: Record<string, unknown>;
      plan: SagaPlan;
    }>,
  ): Promise<SagaInstanceRecord | null> {
    const { context, plan, ...rest } = patch;
    const result = await this.txHost.tx.sagaInstance.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...rest,
        ...(context ? { context: json(context) } : {}),
        ...(plan ? { plan: json(plan) } : {}),
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findById(id);
  }

  private toRecord(row: InstanceRaw): SagaInstanceRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      sagaKey: row.sagaKey,
      definitionId: row.definitionId,
      configId: row.configId,
      rootRefType: row.rootRefType,
      rootRefId: row.rootRefId,
      correlationKey: row.correlationKey,
      status: row.status as SagaInstanceStatus,
      reason: row.reason as SagaInstanceReason | null,
      plan: row.plan as SagaPlan,
      context: (row.context as Record<string, unknown>) ?? {},
      cursor: row.cursor,
      waitingEvent: row.waitingEvent,
      cancelRequestedAt: row.cancelRequestedAt,
      error: row.error,
      deadlineAt: row.deadlineAt,
      version: row.version,
    };
  }
}

// ─── saga_steps ─────────────────────────────────────────────────────────────

interface StepRaw {
  id: string;
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: string;
  action: string | null;
  status: string;
  attempt: number;
  maxAttempts: number;
  runAt: Date;
  lockedBy: string | null;
  lockUntil: Date | null;
  input: unknown;
  output: unknown;
  error: string | null;
}

export interface InsertStepInput {
  tenantId: string;
  companyId: string;
  instanceId: string;
  stepId: string;
  kind: SagaStepKind;
  action: string | null;
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

@Injectable()
export class SagaStepRepository {
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
          action: input.action,
          status: input.status ?? SagaStepStatus.PENDING,
          maxAttempts: input.maxAttempts,
          runAt: input.runAt,
          input: jsonOrNull(input.input),
          output: jsonOrNull(input.output),
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const row = await this.findByInstanceStep(input.instanceId, input.stepId, input.kind);
        if (row) {
          return row;
        }
      }
      throw err;
    }
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

  async findById(id: string): Promise<SagaStepRecord | null> {
    const row = await this.txHost.tx.sagaStep.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findByInstance(instanceId: string): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(row => this.toRecord(row as StepRaw));
  }

  /**
   * Claim due PENDING rows: SKIP LOCKED + lease. A fairness cap keeps one
   * company from starving the batch (overflow rows are released immediately).
   */
  async claimBatch(input: ClaimStepsInput): Promise<SagaStepRecord[]> {
    const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
    const rows = await this.txHost.tx.$queryRaw<StepRaw[]>`
      UPDATE "saga_steps" s
      SET "status" = 'RUNNING',
          "locked_by" = ${input.workerId},
          "lock_until" = ${leaseUntil},
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
      RETURNING *`;

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
      },
    });
  }

  async markSkipped(id: string): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id, status: { in: [SagaStepStatus.PENDING, SagaStepStatus.RUNNING] } },
      data: { status: SagaStepStatus.SKIPPED, lockedBy: null, lockUntil: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id, status: SagaStepStatus.RUNNING },
      data: { status: SagaStepStatus.FAILED, error, lockedBy: null, lockUntil: null },
    });
  }

  async reschedule(id: string, attempt: number, runAt: Date, error: string | null): Promise<void> {
    await this.txHost.tx.sagaStep.updateMany({
      where: { id },
      data: {
        status: SagaStepStatus.PENDING,
        attempt,
        runAt,
        error,
        lockedBy: null,
        lockUntil: null,
      },
    });
  }

  /** PENDING WAIT rows whose timeout instant has passed. */
  async findExpiredWaits(now: Date, limit: number): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { kind: SagaStepKind.WAIT, status: SagaStepStatus.PENDING, runAt: { lte: now } },
      orderBy: { runAt: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row as StepRaw));
  }

  /** Stale RUNNING rows whose lease expired (crashed worker). */
  async findStaleRunning(now: Date, limit: number): Promise<SagaStepRecord[]> {
    const rows = await this.txHost.tx.sagaStep.findMany({
      where: { status: SagaStepStatus.RUNNING, lockUntil: { lt: now } },
      orderBy: { lockUntil: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row as StepRaw));
  }

  private applyFairnessCap(
    rows: StepRaw[],
    fairnessCap: number,
  ): { claimed: StepRaw[]; overflow: StepRaw[] } {
    if (fairnessCap <= 0) {
      return { claimed: rows, overflow: [] };
    }
    const perCompany = new Map<string, number>();
    const claimed: StepRaw[] = [];
    const overflow: StepRaw[] = [];
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

  private toRecord(row: StepRaw): SagaStepRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      instanceId: row.instanceId,
      stepId: row.stepId,
      kind: row.kind as SagaStepKind,
      action: row.action,
      status: row.status as SagaStepStatus,
      attempt: row.attempt,
      maxAttempts: row.maxAttempts,
      runAt: row.runAt,
      lockedBy: row.lockedBy,
      lockUntil: row.lockUntil,
      input: (row.input as Record<string, unknown> | null) ?? null,
      output: (row.output as Record<string, unknown> | null) ?? null,
      error: row.error,
    };
  }
}

// ─── saga_inbox ─────────────────────────────────────────────────────────────

interface InboxRaw {
  id: string;
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: unknown;
  status: string;
  receivedAt: Date;
}

export interface InsertInboxInput {
  tenantId: string;
  companyId: string;
  consumer: string;
  eventId: string;
  eventName: string;
  eventVersion: number;
  correlationKey: string | null;
  instanceId: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class SagaInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  /** Dedupe on (tenant, company, consumer, event); a duplicate returns null. */
  async tryInsert(input: InsertInboxInput): Promise<SagaInboxRecord | null> {
    try {
      const row = await this.txHost.tx.sagaInbox.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          companyId: input.companyId,
          consumer: input.consumer,
          eventId: input.eventId,
          eventName: input.eventName,
          eventVersion: input.eventVersion,
          correlationKey: input.correlationKey,
          instanceId: input.instanceId,
          payload: json(input.payload),
          status: SagaInboxStatus.RECEIVED,
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }
  }

  async markBuffered(
    id: string,
    correlationKey: string | null,
    instanceId: string | null,
  ): Promise<void> {
    await this.txHost.tx.sagaInbox.updateMany({
      where: { id },
      data: { status: SagaInboxStatus.BUFFERED, correlationKey, instanceId },
    });
  }

  async markConsumed(id: string): Promise<void> {
    await this.txHost.tx.sagaInbox.updateMany({
      where: { id },
      data: { status: SagaInboxStatus.CONSUMED, processedAt: new Date() },
    });
  }

  async markIgnored(id: string, reason: string): Promise<void> {
    await this.txHost.tx.sagaInbox.updateMany({
      where: { id },
      data: { status: SagaInboxStatus.IGNORED, reason, processedAt: new Date() },
    });
  }

  /** BUFFERED events for an instance, oldest first (match/`when` filtered by the engine). */
  async listBuffered(
    instanceId: string,
    eventName: string,
    eventVersion: number,
    limit: number,
  ): Promise<SagaInboxRecord[]> {
    const rows = await this.txHost.tx.sagaInbox.findMany({
      where: {
        instanceId,
        eventName,
        eventVersion,
        status: SagaInboxStatus.BUFFERED,
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
    });
    return rows.map(row => this.toRecord(row as InboxRaw));
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.txHost.tx.sagaInbox.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private toRecord(row: InboxRaw): SagaInboxRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      consumer: row.consumer,
      eventId: row.eventId,
      eventName: row.eventName,
      eventVersion: row.eventVersion,
      correlationKey: row.correlationKey,
      instanceId: row.instanceId,
      payload: (row.payload as Record<string, unknown>) ?? {},
      status: row.status as SagaInboxStatus,
      receivedAt: row.receivedAt,
    };
  }
}
