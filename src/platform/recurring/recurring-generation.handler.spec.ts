import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { ConditionEvaluator } from '@platform/condition-engine/ports/condition-evaluator.port';
import { SchedulerPort } from '@platform/scheduler/ports/scheduler.port';
import { RecurringGenerationHandler } from './recurring-generation.handler';
import { RecurringOccurrenceRequested } from './events/recurring-occurrence-requested.event';
import { DomainEvent } from '@business/shared-business/domain/bases/event.base';
import { RecurringExecutionRepositoryPort } from './ports/recurring-execution-repository.port';
import { RecurringTemplateRepositoryPort } from './ports/recurring-template-repository.port';
import { RecurringTemplateRecord } from './recurring-template.types';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

describe('RecurringGenerationHandler', () => {
  beforeAll(() => initNoopTransactionHost());

  const findById = jest.fn();
  const templateUpdate = jest.fn();
  const templateRepository: RecurringTemplateRepositoryPort = {
    create: jest.fn(),
    findById,
    update: templateUpdate,
    list: jest.fn(),
    findActiveByEventName: jest.fn(),
  };

  const claim = jest.fn();
  const skip = jest.fn();
  const complete = jest.fn();
  const fail = jest.fn();
  const executionRepository: RecurringExecutionRepositoryPort = {
    claim,
    findById: jest.fn(),
    findByTemplateAndTrigger: jest.fn().mockResolvedValue(null),
    failStale: jest.fn().mockResolvedValue(0),
    complete,
    fail,
    skip,
  };

  const append = jest
    .fn<Promise<void>, [DomainEvent, string, string]>()
    .mockResolvedValue(undefined);
  const outboxWriter: OutboxWriterPort = { append };

  const rescheduleByAggregate = jest.fn();
  const schedulerPort: SchedulerPort = {
    schedule: jest.fn(),
    reschedule: jest.fn(),
    cancel: jest.fn(),
    cancelByAggregate: jest.fn(),
    rescheduleByAggregate,
  };
  const conditionEvaluator: ConditionEvaluator = { evaluate: jest.fn() };

  const handler = new RecurringGenerationHandler(
    templateRepository,
    executionRepository,
    outboxWriter,
    schedulerPort,
    conditionEvaluator,
  );

  const template: RecurringTemplateRecord = {
    id: 'tpl-1',
    tenantId: 't1',
    templateNo: 'RCR-000001',
    name: 'Monthly supplies',
    status: 'ACTIVE',
    targetEntityType: 'PurchaseOrder',
    targetEntityId: null,
    originDocumentType: null,
    originDocumentId: null,
    partyId: 'vendor-1',
    partyType: 'VENDOR',
    currency: 'USD',
    triggerType: 'TIME',
    eventName: null,
    frequency: 'MONTHLY',
    interval: 1,
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: null,
    nextRunDate: new Date('2026-10-01T00:00:00.000Z'),
    lastRunDate: null,
    timeZone: 'UTC',
    autoPost: false,
    autoEmail: false,
    autoApprove: false,
    headerOverrides: { branchId: 'b1' },
    generationCondition: null,
    lines: [{ productId: 'p1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockResolvedValue(template);
    claim.mockResolvedValue({ id: 'exec-1' });
    append.mockResolvedValue(undefined);
  });

  it('writes RecurringOccurrenceRequested to the outbox and does not create the document', async () => {
    await handler.handle({
      jobId: 'job-1',
      tenantId: 't1',
      aggregateId: 'tpl-1',
      jobType: 'Recurring',
    });

    const event = append.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(RecurringOccurrenceRequested);
    expect(event).toMatchObject({
      executionId: 'exec-1',
      targetEntityType: 'PurchaseOrder',
      partyId: 'vendor-1',
      autoPost: false,
    });
    expect(append).toHaveBeenCalledWith(
      expect.any(RecurringOccurrenceRequested),
      'RecurringTemplate',
      'tpl-1',
    );
    expect(complete).not.toHaveBeenCalled();
    expect(rescheduleByAggregate).toHaveBeenCalled();
  });

  it('skips the outbox when the template is not active', async () => {
    findById.mockResolvedValue({ ...template, status: 'PAUSED' });

    await handler.handle({
      jobId: 'job-1',
      tenantId: 't1',
      aggregateId: 'tpl-1',
      jobType: 'Recurring',
    });

    expect(skip).toHaveBeenCalledWith('exec-1', 'TemplateNotActive');
    expect(append).not.toHaveBeenCalled();
  });
});
