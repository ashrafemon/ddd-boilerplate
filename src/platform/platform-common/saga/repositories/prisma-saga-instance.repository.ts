import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma } from '../../../../generated/client';
import { PrismaJson } from '@platform/platform-common/persistence/prisma-json';
import {
  SagaInstanceReason,
  SagaInstanceRecord,
  SagaInstanceStatus,
  SagaPlan,
} from '../types/saga.types';

/** Values needed to open a live instance for one correlation key. */
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

/** Fields a transition may patch; `version` is the CAS fence, never a patch. */
export interface UpdateInstancePatch {
  status?: SagaInstanceStatus;
  reason?: SagaInstanceReason | null;
  cursor?: number;
  waitingEvent?: string | null;
  cancelRequestedAt?: Date | null;
  lastError?: string | null;
  deadlineAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  context?: Record<string, unknown>;
  plan?: SagaPlan;
}

const UNIQUE_VIOLATION = 'P2002';

const TERMINAL: ReadonlySet<SagaInstanceStatus> = new Set([
  SagaInstanceStatus.COMPLETED,
  SagaInstanceStatus.COMPENSATED,
  SagaInstanceStatus.CANCELLED,
  SagaInstanceStatus.FAILED_MANUAL,
]);

/**
 * `<sagaKey>|<correlationKey>` — the live-instance uniqueness key.
 *
 * `encodeURIComponent` leaves only `A-Za-z0-9-_.!~*'()` untouched, so `|` cannot
 * appear inside a segment: `('a|b', 'c')` and `('a', 'b|c')` stay distinct. (A NUL
 * separator would be cleaner in the abstract but Postgres text columns reject it.)
 */
export function buildLiveKey(sagaKey: string, correlationKey: string): string {
  return `${encodeURIComponent(sagaKey)}|${encodeURIComponent(correlationKey)}`;
}

interface InstanceRow {
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
  lastError: string | null;
  deadlineAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  version: number;
}

const json = (value: unknown): Prisma.InputJsonValue =>
  PrismaJson.toInput(value as object) as Prisma.InputJsonValue;

/**
 * PostgreSQL adapter for `saga_instances`.
 *
 * `live_key` is set on insert and NULLed by every terminal transition, which is
 * the partial-unique semantics (`WHERE status IN ('RUNNING','WAITING',
 * 'COMPENSATING')`) expressed with a plain unique index.
 */
@Injectable()
export class PrismaSagaInstanceRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

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
          liveKey: buildLiveKey(input.sagaKey, input.correlationKey),
          status: SagaInstanceStatus.RUNNING,
          plan: json(input.plan),
          context: json(input.context),
          cursor: 0,
          deadlineAt: input.deadlineAt,
          startedAt: new Date(),
        },
      });
      return this.toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
        return null;
      }
      throw err;
    }
  }

  async findById(id: string): Promise<SagaInstanceRecord | null> {
    const row = await this.txHost.tx.sagaInstance.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findLiveByKey(sagaKey: string, correlationKey: string): Promise<SagaInstanceRecord[]> {
    const rows = await this.txHost.tx.sagaInstance.findMany({
      where: {
        sagaKey,
        correlationKey,
        status: {
          in: [
            SagaInstanceStatus.RUNNING,
            SagaInstanceStatus.WAITING,
            SagaInstanceStatus.COMPENSATING,
          ],
        },
      },
    });
    return rows.map(row => this.toRecord(row));
  }

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
    return rows.map(row => this.toRecord(row));
  }

  async updateCas(
    id: string,
    expectedVersion: number,
    patch: UpdateInstancePatch,
  ): Promise<SagaInstanceRecord | null> {
    const { context, plan, status, ...rest } = patch;
    const terminal = status ? TERMINAL.has(status) : false;

    const result = await this.txHost.tx.sagaInstance.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...rest,
        ...(status ? { status } : {}),
        ...(context ? { context: json(context) } : {}),
        ...(plan ? { plan: json(plan) } : {}),
        // Terminal rows release the live key so a later event may start a new
        // instance for the same correlation key.
        ...(terminal ? { liveKey: null, finishedAt: new Date() } : {}),
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findById(id);
  }

  private toRecord(row: InstanceRow): SagaInstanceRecord {
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
      lastError: row.lastError,
      deadlineAt: row.deadlineAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      version: row.version,
    };
  }
}
