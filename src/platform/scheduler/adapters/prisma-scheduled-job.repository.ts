import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConfigService } from '@config/config.service';
import {
  CreateScheduledJobData,
  ScheduledJobRepositoryPort,
} from '../ports/scheduled-job-repository.port';
import {
  ClaimedJob,
  JobScope,
  JobStatus,
  ScheduleMode,
  ScheduledJobRecord,
} from '../scheduler.types';

type TxClient = TransactionHost<TransactionalAdapterPrisma>['tx'];

@Injectable()
export class PrismaScheduledJobRepository implements ScheduledJobRepositoryPort {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly configService: ConfigService,
  ) {}

  private get tx(): TxClient {
    return this.txHost.tx;
  }

  async create(data: CreateScheduledJobData): Promise<string> {
    const job = await this.tx.scheduledJob.create({
      data: {
        jobType: data.jobType,
        scope: data.scope,
        scheduleMode: data.scheduleMode,
        cronExpression: data.cronExpression ?? null,
        nextRunAt: data.nextRunAt,
        tenantId: data.tenantId ?? null,
        aggregateType: data.aggregateType ?? null,
        aggregateId: data.aggregateId ?? null,
        payload: toPrismaJson(data.payload),
        status: 'PENDING',
      },
    });
    return job.id;
  }

  async findById(jobId: string): Promise<ScheduledJobRecord | null> {
    const row = await this.tx.scheduledJob.findUnique({ where: { id: jobId } });
    return row ? mapJob(row) : null;
  }

  async list(options?: {
    jobType?: string;
    status?: JobStatus | string;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledJobRecord[]> {
    const rows = await this.tx.scheduledJob.findMany({
      where: {
        jobType: options?.jobType,
        status: options?.status as never,
      },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
      orderBy: { nextRunAt: 'asc' },
    });
    return rows.map(mapJob);
  }

  async cancel(jobId: string): Promise<void> {
    await this.tx.scheduledJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', lockedUntil: null, lockedBy: null },
    });
  }

  async cancelByAggregate(aggregateType: string, aggregateId: string): Promise<void> {
    await this.tx.scheduledJob.updateMany({
      where: { aggregateType, aggregateId },
      data: { status: 'CANCELLED', lockedUntil: null, lockedBy: null },
    });
  }

  async reschedule(jobId: string, nextRunAt: Date): Promise<void> {
    await this.tx.scheduledJob.update({
      where: { id: jobId },
      data: { nextRunAt, status: 'PENDING', lockedUntil: null, lockedBy: null },
    });
  }

  async rescheduleByAggregate(
    aggregateType: string,
    aggregateId: string,
    nextRunAt: Date,
  ): Promise<void> {
    await this.tx.scheduledJob.updateMany({
      where: { aggregateType, aggregateId },
      data: { nextRunAt, status: 'PENDING', lockedUntil: null, lockedBy: null },
    });
  }

  async claimDue(batchSize: number, lockedBy: string): Promise<ClaimedJob[]> {
    const now = new Date();
    const { lockTtlMs } = this.configService.getScheduler();
    const lockedUntil = new Date(now.getTime() + lockTtlMs);

    return this.tx.$transaction(async tx => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          tenantId: string | null;
          jobType: string;
          scope: string;
          scheduleMode: string;
          cronExpression: string | null;
          aggregateType: string | null;
          aggregateId: string | null;
          payload: unknown;
          nextRunAt: Date;
          retryCount: number;
          version: number;
        }>
      >`
        SELECT id, "tenantId", "jobType", scope, "scheduleMode", "cronExpression",
               "aggregateType", "aggregateId", payload, "nextRunAt", "retryCount", version
        FROM "scheduled_jobs"
        WHERE status = 'PENDING' AND "nextRunAt" <= ${now}
        ORDER BY "nextRunAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) {
        return [];
      }

      await tx.scheduledJob.updateMany({
        where: { id: { in: rows.map(r => r.id) } },
        data: { status: 'CLAIMED', lockedUntil, lockedBy },
      });

      return rows.map(r => ({
        id: r.id,
        tenantId: r.tenantId,
        jobType: r.jobType,
        scope: r.scope as JobScope,
        scheduleMode: r.scheduleMode as ScheduleMode,
        cronExpression: r.cronExpression,
        aggregateType: r.aggregateType,
        aggregateId: r.aggregateId,
        payload: (r.payload as Record<string, unknown> | null) ?? null,
        nextRunAt: r.nextRunAt,
        retryCount: r.retryCount,
        version: r.version,
      }));
    });
  }

  async findOverdue(thresholdMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMs);
    return this.tx.scheduledJob.count({
      where: {
        status: { in: ['PENDING', 'CLAIMED'] },
        nextRunAt: { lt: cutoff },
      },
    });
  }

  async markPendingWithNextRun(jobId: string, nextRunAt: Date, lastRunAt?: Date): Promise<void> {
    await this.tx.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        nextRunAt,
        lastRunAt: lastRunAt ?? undefined,
        lockedUntil: null,
        lockedBy: null,
      },
    });
  }

  async touchLastRunAt(jobId: string): Promise<void> {
    await this.tx.scheduledJob.update({
      where: { id: jobId },
      data: { lastRunAt: new Date() },
    });
  }

  async markFailed(jobId: string): Promise<void> {
    await this.tx.scheduledJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        retryCount: { increment: 1 },
        lockedUntil: null,
        lockedBy: null,
      },
    });
  }

  async releaseStaleClaims(): Promise<number> {
    const result = await this.tx.scheduledJob.updateMany({
      where: { status: 'CLAIMED', lockedUntil: { lt: new Date() } },
      data: { status: 'PENDING', lockedUntil: null, lockedBy: null },
    });
    return result.count;
  }

  async updateWithVersionCheck(
    jobId: string,
    expectedVersion: number,
    data: {
      cronExpression?: string | null;
      nextRunAt?: Date;
      scheduleMode?: ScheduleMode;
    },
  ): Promise<boolean> {
    const result = await this.tx.scheduledJob.updateMany({
      where: { id: jobId, version: expectedVersion },
      data: {
        cronExpression: data.cronExpression,
        nextRunAt: data.nextRunAt,
        scheduleMode: data.scheduleMode,
        version: { increment: 1 },
      },
    });
    return result.count === 1;
  }
}

function toPrismaJson(value: Record<string, unknown> | undefined): object | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}

function mapJob(row: {
  id: string;
  tenantId: string | null;
  jobType: string;
  scope: string;
  scheduleMode: string;
  cronExpression: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: unknown;
  nextRunAt: Date;
  lastRunAt: Date | null;
  status: string;
  retryCount: number;
  version: number;
  lockedUntil: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ScheduledJobRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    jobType: row.jobType,
    scope: row.scope as JobScope,
    scheduleMode: row.scheduleMode as ScheduleMode,
    cronExpression: row.cronExpression,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    status: row.status as JobStatus,
    retryCount: row.retryCount,
    version: row.version,
    lockedUntil: row.lockedUntil,
    lockedBy: row.lockedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
