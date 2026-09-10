import { ScheduledJobProcessor } from './scheduled-job.processor';
import { ScheduledJobHandlerRegistry } from './scheduled-job-handler.registry';
import { SchedulerEventPublisherPort } from './ports/scheduler-event-publisher.port';
import { SchedulerQueuedJob } from './ports/scheduler-job-queue.port';

function queued(overrides: Partial<SchedulerQueuedJob> = {}): SchedulerQueuedJob {
  return {
    jobId: 'job-1',
    jobType: 'Recurring',
    tenantId: null,
    scope: 'AGGREGATE',
    aggregateType: 'RecurringTemplate',
    aggregateId: 'agg-1',
    payload: null,
    idempotencyKey: 'idem-1',
    priority: 'normal',
    ...overrides,
  };
}

describe('ScheduledJobProcessor', () => {
  it('fires the registered handler asynchronously with the idempotencyKey', async () => {
    const registry = new ScheduledJobHandlerRegistry();
    const handle = jest.fn().mockResolvedValue(undefined);
    registry.register('Recurring', { handle });
    const publishJobDue = jest.fn().mockResolvedValue(undefined);
    const publisher = { publishJobDue } as unknown as SchedulerEventPublisherPort;
    const processor = new ScheduledJobProcessor(registry, publisher);

    await processor.process(queued());

    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', idempotencyKey: 'idem-1' }),
    );
    expect(publishJobDue).not.toHaveBeenCalled();
  });

  it('publishes to RabbitMQ when no handler is registered', async () => {
    const registry = new ScheduledJobHandlerRegistry();
    const publishJobDue = jest.fn().mockResolvedValue(undefined);
    const publisher = { publishJobDue } as unknown as SchedulerEventPublisherPort;
    const processor = new ScheduledJobProcessor(registry, publisher);
    const job = queued();

    await processor.process(job);

    expect(publishJobDue).toHaveBeenCalledWith(job);
  });
});
