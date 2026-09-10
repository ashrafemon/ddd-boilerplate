import { SchedulerPortFacade } from './usecases/scheduler-port.facade';
import { RegisterScheduledJobPort } from './ports/register-scheduled-job.port';
import { CancelScheduledJobPort } from './ports/cancel-scheduled-job.port';
import { RescheduleExternalJobPort } from './ports/reschedule-external-job.port';
import { JobScope, ScheduleMode } from './scheduler.types';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';

describe('scheduler wiring smoke', () => {
  it('SchedulerPortFacade maps schedule to AGGREGATE + EXTERNAL register', async () => {
    const execute = jest.fn().mockResolvedValue('job-id');
    const register = { execute } as unknown as RegisterScheduledJobPort;
    const cancel = {} as CancelScheduledJobPort;
    const reschedule = {} as RescheduleExternalJobPort;

    const facade = new SchedulerPortFacade(register, cancel, reschedule);
    const id = await facade.schedule({
      jobType: 'Recurring',
      aggregateType: 'RecurringTemplate',
      aggregateId: 'agg-1',
      nextRunAt: new Date('2026-01-02T00:00:00.000Z'),
      tenantId: 't1',
    });

    expect(id).toBe('job-id');
    expect(execute).toHaveBeenCalledWith({
      jobType: 'Recurring',
      scope: JobScope.AGGREGATE,
      scheduleMode: ScheduleMode.EXTERNAL,
      nextRunAt: new Date('2026-01-02T00:00:00.000Z'),
      tenantId: 't1',
      aggregateType: 'RecurringTemplate',
      aggregateId: 'agg-1',
    });
  });

  it('registry accepts handler registration by jobType', () => {
    const registry = new ScheduledJobHandlerRegistry();
    registry.register('Recurring', { handle: () => Promise.resolve() });
    expect(registry.has('Recurring')).toBe(true);
  });
});
