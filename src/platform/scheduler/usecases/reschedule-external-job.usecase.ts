import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { JobStatus, ScheduledJobRecord } from '../scheduler.types';

@Injectable()
export class RescheduleExternalJobUseCase {
  constructor(
    private readonly jobs: ScheduledJobRepositoryPort,
    private readonly audit: AuditPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  execute(jobId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.reschedule(jobId, nextRunAt);
  }

  executeByAggregate(aggregateType: string, aggregateId: string, nextRunAt: Date): Promise<void> {
    return this.jobs.rescheduleByAggregate(aggregateType, aggregateId, nextRunAt);
  }

  /**
   * Ops re-fire: force a job due-now so the next ticker pass (<= 30 s) claims
   * and dispatches it — used for backfills and after incident recovery.
   * Cancelled jobs stay cancelled; handlers own their own idempotency
   * (e.g. the recurring claim) if a run was already in flight.
   */
  async dispatchNow(jobId: string, tenantId?: string): Promise<ScheduledJobRecord> {
    tenantId = tenantId ?? this.requestContext.getTenantId();
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    if (job.status === JobStatus.CANCELLED) {
      throw new ConflictException(`Scheduled job '${jobId}' is cancelled and cannot be re-fired`);
    }
    if (job.status === JobStatus.CLAIMED || job.status === JobStatus.RUNNING) {
      throw new ConflictException(
        `Scheduled job '${jobId}' is currently in flight; wait for it to settle before re-firing`,
      );
    }
    await this.jobs.reschedule(jobId, new Date());
    const updated = await this.jobs.findById(jobId);
    if (!updated) {
      throw new NotFoundException(`Scheduled job '${jobId}' not found`);
    }
    await this.audit.record({
      action: 'scheduler.job.dispatch-now',
      entityType: 'ScheduledJob',
      entityId: jobId,
      changes: { jobType: job.jobType, previousStatus: job.status },
    });
    return updated;
  }
}
