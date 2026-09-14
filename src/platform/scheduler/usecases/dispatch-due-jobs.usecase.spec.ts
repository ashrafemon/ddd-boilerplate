import { ConfigService } from '@config/config.service';
import { SchedulerTickHeartbeat } from '../scheduler-tick.heartbeat';
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
  const recordFailure = jest.fn().mockResolvedValue('RETRYING');
  const jobs = {
    claimDue,
    markPendingWithNextRun,
    touchLastRunAt,
    recordFailure,
  } as unknown as ScheduledJobRepositoryPort;

  const acquire = jest.fn().mockResolvedValue(true);
  const release = jest.fn().mockResolvedValue(undefined);
  const lock = { acquire, release } as unknown as DistributedLockPort;

  const enqueue = jest.fn().mockResolvedValue(undefined);
  const queue = { enqueue } as unknown as SchedulerJobQueuePort;

  const insert = jest.fn().mockResolvedValue(undefined);
  const recordOutcome = jest.fn().mockResolvedValue(undefined);
  const dispatchLogs = {
    insert,
    recordOutcome,
  } as unknown as ScheduledJobDispatchLogRepositoryPort;

  const configService = {
    getScheduler: () => ({
      pollIntervalMs: 30_000,
      batchSize: 20,
      lockTtlMs: 300_000,
      reconciliationIntervalMs: 300_000,
      workerConcurrency: 5,
      jobAttempts: 3,
      maxRetries: 5,
      retryBackoffBaseMs: 60_000,
    }),
  } as unknown as ConfigService;

  const usecase = new DispatchDueJobsUseCase(
    jobs,
    lock,
    queue,
    dispatchLogs,
    configService,
    new SchedulerTickHeartbeat(),
  );

  return {
    usecase,
    acquire,
    release,
    enqueue,
    insert,
    recordOutcome,
    claimDue,
    markPendingWithNextRun,
    touchLastRunAt,
    recordFailure,
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

  it('backs off with retry escalation when enqueue rejects', async () => {
    const { usecase, enqueue, recordFailure, recordOutcome } = makeUseCase([claimed()]);
    enqueue.mockRejectedValue(new Error('redis down'));

    await usecase.execute({ batchSize: 20 });

    expect(recordFailure).toHaveBeenCalledWith('job-1', {
      maxRetries: 5,
      backoffBaseMs: 60_000,
    });
    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledJobId: 'job-1', outcome: 'FAILED' }),
    );
  });

  it('uses a deterministic slot key so a re-fired dispatch dedupes', async () => {
    const job = claimed({ nextRunAt: new Date('2026-01-01T00:00:00.000Z') });
    const first = makeUseCase([job]);
    const second = makeUseCase([job]);

    await first.usecase.execute({ batchSize: 20 });
    await second.usecase.execute({ batchSize: 20 });

    const callsOf = (mock: { mock: { calls: unknown[][] } }) => mock.mock.calls;
    const keyOf = (call: unknown[]) => (call[0] as { idempotencyKey: string }).idempotencyKey;
    expect(keyOf(callsOf(first.enqueue)[0])).toBe(keyOf(callsOf(second.enqueue)[0]));
    expect(keyOf(callsOf(first.enqueue)[0])).toMatch(/^[0-9a-f]{64}$/);
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
