import { z } from 'zod';
import { SchedulerPort } from '../ports/scheduler.port';
import { ScheduledJobDispatchLogRepositoryPort } from '../ports/scheduled-job-dispatch-log-repository.port';
import { ScheduledJobEditLogRepositoryPort } from '../ports/scheduled-job-edit-log-repository.port';
import { ScheduledJobRepositoryPort } from '../ports/scheduled-job-repository.port';
import { JobScope, JobStatus, ScheduledJobRecord, ScheduleMode } from '../scheduler.types';
import { GetScheduledJobStatusUseCase } from '../usecases/get-scheduled-job-status.usecase';
import { GetSchedulerHealthMetricsUseCase } from '../usecases/get-scheduler-health-metrics.usecase';
import { SchedulerTickHeartbeat } from '../scheduler-tick.heartbeat';
import { ListScheduledJobDispatchLogUseCase } from '../usecases/list-scheduled-job-dispatch-log.usecase';
import { UpdateScheduledJobUseCase } from '../usecases/update-scheduled-job.usecase';
import { SchedulerController, SchedulerHealthController } from './scheduler.controller';
import { UpdateScheduledJobDto, updateScheduledJobSchema } from './requests/scheduler.request.dto';

function aJob(): ScheduledJobRecord {
  return {
    id: 'j1',
    tenantId: null,
    jobType: 'Recurring',
    scope: JobScope.AGGREGATE,
    scheduleMode: ScheduleMode.EXTERNAL,
    cronExpression: null,
    aggregateType: 'RecurringTemplate',
    aggregateId: 'a1',
    payload: null,
    nextRunAt: new Date(),
    lastRunAt: null,
    status: JobStatus.PENDING,
    retryCount: 0,
    version: 0,
    lockedUntil: null,
    lockedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeJobs(overrides: Partial<ScheduledJobRepositoryPort> = {}): ScheduledJobRepositoryPort {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(aJob()),
    list: jest.fn().mockResolvedValue([]),
    cancel: jest.fn(),
    cancelByAggregate: jest.fn(),
    reschedule: jest.fn(),
    rescheduleByAggregate: jest.fn(),
    claimDue: jest.fn(),
    findOverdue: jest.fn().mockResolvedValue(0),
    markPendingWithNextRun: jest.fn(),
    touchLastRunAt: jest.fn(),
    markFailed: jest.fn(),
    releaseStaleClaims: jest.fn(),
    updateWithVersionCheck: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const makeDispatchLogs = (): ScheduledJobDispatchLogRepositoryPort => ({
  insert: jest.fn(),
  listByJobId: jest.fn().mockResolvedValue([]),
  countFailuresSince: jest.fn().mockResolvedValue(0),
});

const makeSchedulerPort = (): SchedulerPort => ({
  schedule: jest.fn(),
  reschedule: jest.fn(),
  cancel: jest.fn(),
  cancelByAggregate: jest.fn(),
  rescheduleByAggregate: jest.fn(),
});

function makeController(jobs = makeJobs()) {
  const getStatus = new GetScheduledJobStatusUseCase(jobs);
  const listDispatchLog = new ListScheduledJobDispatchLogUseCase(makeDispatchLogs());
  const updateJob = new UpdateScheduledJobUseCase(jobs, {
    insert: jest.fn(),
  } satisfies ScheduledJobEditLogRepositoryPort);
  return new SchedulerController(getStatus, listDispatchLog, updateJob, makeSchedulerPort());
}

describe('SchedulerController', () => {
  it('lists jobs through the repository port', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const controller = makeController(makeJobs({ list }));

    const result = await controller.list({});
    expect(result.data).toEqual([]);
    expect(list).toHaveBeenCalled();
  });

  it('reads a single job status', async () => {
    const controller = makeController();
    const result = await controller.get('j1');
    expect(result.data.id).toBe('j1');
  });

  it('updates a job and returns the fresh record', async () => {
    const controller = makeController();
    const body = {
      expectedVersion: 0,
      nextRunAt: '2026-01-02T00:00:00.000Z',
    } satisfies z.infer<typeof updateScheduledJobSchema> as UpdateScheduledJobDto;
    const result = await controller.update('j1', body);
    expect(result.data.id).toBe('j1');
    expect(result.message).toBe('Scheduled job updated');
  });
});

describe('SchedulerHealthController', () => {
  it('returns health metrics', async () => {
    const controller = new SchedulerHealthController(
      new GetSchedulerHealthMetricsUseCase(
        makeJobs(),
        makeDispatchLogs(),
        new SchedulerTickHeartbeat(),
      ),
    );
    const result = await controller.healthMetrics();
    expect(result.data.overdueCount).toBe(0);
  });
});
