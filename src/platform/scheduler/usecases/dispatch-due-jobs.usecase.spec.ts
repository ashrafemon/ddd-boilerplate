import { ConfigService } from '@config/config.service';
import { DispatchDueJobsUseCase } from './dispatch-due-jobs.usecase';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { DistributedLockPort } from '../ports/distributed-lock.port';
import { SchedulerJobQueuePort } from '../ports/scheduler-job-queue.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ClaimedJob, JobScope, ScheduleMode } from '../scheduler.types';

function claimed(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    tenantId: null,
    jobType: 'Recurring',
    scope: JobScope.AGGREGATE,
    scheduleMode: ScheduleMode.EXTERNAL,
    cronExpression: null,
    aggregateType: 'RecurringTemplate',
    aggregateId: 'agg-1',
    payload: null,
    nextRunAt: new Date(),
    retryCount: 0,
    version: 0,
    ...overrides,
  };
}

function makeUseCase(rows: ClaimedJob[]) {
  const claimDue = jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]);
  const markPendingWithNextRun = jest.fn();
  const touchLastRunAt = jest.fn();
  const markFailed = jest.fn();
  const jobs = {
    claimDue,
    markPendingWithNextRun,
    touchLastRunAt,
    markFailed,
  } as unknown as ScheduledJobRepositoryPort;

  const acquire = jest.fn().mockResolvedValue(true);
  const release = jest.fn().mockResolvedValue(undefined);
  const lock = { acquire, release } as unknown as DistributedLockPort;

  const enqueue = jest.fn().mockResolvedValue(undefined);
  const queue = { enqueue } as unknown as SchedulerJobQueuePort;

  const insert = jest.fn().mockResolvedValue(undefined);
  const dispatchLogs = { insert } as unknown as ScheduledJobDispatchLogRepositoryPort;

  const configService = {
    getScheduler: () => ({
      pollIntervalMs: 30_000,
      batchSize: 20,
      lockTtlMs: 300_000,
      reconciliationIntervalMs: 300_000,
      workerConcurrency: 5,
      jobAttempts: 3,
    }),
  } as unknown as ConfigService;

  const usecase = new DispatchDueJobsUseCase(jobs, lock, queue, dispatchLogs, configService);

  return {
    usecase,
    acquire,
    release,
    enqueue,
    insert,
    claimDue,
    markPendingWithNextRun,
    touchLastRunAt,
    markFailed,
  };
}

describe('DispatchDueJobsUseCase', () => {
  it('enqueues the claimed job with an idempotencyKey and does not run handlers inline', async () => {
    const { usecase, enqueue, insert, touchLastRunAt, release } = makeUseCase([claimed()]);

    const count = await usecase.execute({ batchSize: 20 });

    expect(count).toBe(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        jobType: 'Recurring',
        idempotencyKey: expect.any(String) as string,
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledJobId: 'job-1',
        idempotencyKey: expect.any(String) as string,
      }),
    );
    expect(touchLastRunAt).toHaveBeenCalledWith('job-1');
    expect(release).toHaveBeenCalledWith('job-1');
  });

  it('fail-closes when Redis lock acquire returns false', async () => {
    const { usecase, acquire, enqueue, release } = makeUseCase([claimed()]);
    acquire.mockResolvedValue(false);

    await usecase.execute({ batchSize: 20 });

    expect(enqueue).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('marks FAILED when enqueue rejects', async () => {
    const { usecase, enqueue, markFailed } = makeUseCase([claimed()]);
    enqueue.mockRejectedValue(new Error('redis down'));

    await usecase.execute({ batchSize: 20 });

    expect(markFailed).toHaveBeenCalledWith('job-1');
  });

  it('advances cron nextRunAt after a successful enqueue', async () => {
    const { usecase, markPendingWithNextRun } = makeUseCase([
      claimed({
        scheduleMode: ScheduleMode.CRON,
        cronExpression: '0 0 * * *',
      }),
    ]);

    await usecase.execute({ batchSize: 20 });

    expect(markPendingWithNextRun).toHaveBeenCalledWith(
      'job-1',
      expect.any(Date),
      expect.any(Date),
    );
  });
});
