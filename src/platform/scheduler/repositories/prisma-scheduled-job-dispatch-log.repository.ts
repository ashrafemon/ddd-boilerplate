import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  InsertDispatchLogInput,
  ScheduledJobDispatchLogRepositoryPort,
} from '../ports/scheduled-job-dispatch-log-repository.port';
import { DispatchStatus, ScheduledJobDispatchLogRecord } from '../scheduler.types';

@Injectable()
export class PrismaScheduledJobDispatchLogRepository implements ScheduledJobDispatchLogRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

  async insert(input: InsertDispatchLogInput): Promise<void> {
    await this.txHost.tx.scheduledJobDispatchLog.create({
      data: {
        id: input.id,
        tenantId: input.tenantId ?? null,
        scheduledJobId: input.scheduledJobId,
        jobType: input.jobType,
        dispatchedAt: input.dispatchedAt,
        completedAt: input.completedAt ?? null,
        outcome: input.outcome,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage ?? null,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async listByJobId(
    jobId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ScheduledJobDispatchLogRecord[]> {
    const rows = await this.txHost.tx.scheduledJobDispatchLog.findMany({
      where: { scheduledJobId: jobId },
      orderBy: { dispatchedAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      scheduledJobId: r.scheduledJobId,
      jobType: r.jobType,
      dispatchedAt: r.dispatchedAt,
      completedAt: r.completedAt,
      outcome: r.outcome as DispatchStatus,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
      idempotencyKey: r.idempotencyKey,
    }));
  }

  async countFailuresSince(since: Date): Promise<number> {
    return this.txHost.tx.scheduledJobDispatchLog.count({
      where: {
        outcome: { in: ['FAILED', 'DEAD_LETTERED'] },
        dispatchedAt: { gte: since },
      },
    });
  }
}
