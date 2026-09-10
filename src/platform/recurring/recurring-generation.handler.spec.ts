import { RecurringGenerationHandler } from './recurring-generation.handler';
import { RecurringOccurrenceRequested } from './events/recurring-occurrence-requested.event';

describe('RecurringGenerationHandler', () => {
  const templateRepository = { findById: jest.fn(), update: jest.fn() };
  const executionRepository = {
    claim: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    skip: jest.fn(),
  };
  const outboxWriter = { append: jest.fn() };
  const schedulerPort = { rescheduleByAggregate: jest.fn(), cancelByAggregate: jest.fn() };
  const conditionEvaluator = { evaluate: jest.fn() };

  const handler = new RecurringGenerationHandler(
    templateRepository as never,
    executionRepository as never,
    outboxWriter,
    schedulerPort,
    conditionEvaluator,
  );

  const template = {
    id: 'tpl-1',
    status: 'ACTIVE',
    targetEntityType: 'PurchaseOrder',
    partyId: 'vendor-1',
    partyType: 'VENDOR',
    currency: 'USD',
    headerOverrides: { branchId: 'b1' },
    lines: [{ productId: 'p1' }],
    generationCondition: null,
    autoPost: false,
    triggerType: 'TIME',
    frequency: 'MONTHLY',
    interval: 1,
    tenantId: 't1',
    nextRunDate: new Date('2026-10-01T00:00:00.000Z'),
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: null,
    timeZone: 'UTC',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    templateRepository.findById.mockResolvedValue(template);
    executionRepository.claim.mockResolvedValue({ id: 'exec-1' });
    outboxWriter.append.mockResolvedValue(undefined);
  });

  it('writes RecurringOccurrenceRequested to the outbox and does not create the document', async () => {
    await handler.handle({
      jobId: 'job-1',
      tenantId: 't1',
      aggregateId: 'tpl-1',
      jobType: 'Recurring',
    });

    expect(outboxWriter.append).toHaveBeenCalledWith(
      expect.any(RecurringOccurrenceRequested),
      'RecurringTemplate',
      'tpl-1',
    );
    expect(outboxWriter.append).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 'exec-1',
        targetEntityType: 'PurchaseOrder',
        partyId: 'vendor-1',
        autoPost: false,
      }),
      'RecurringTemplate',
      'tpl-1',
    );
    expect(executionRepository.complete).not.toHaveBeenCalled();
    expect(schedulerPort.rescheduleByAggregate).toHaveBeenCalled();
  });

  it('skips the outbox when the template is not active', async () => {
    templateRepository.findById.mockResolvedValue({ ...template, status: 'PAUSED' });

    await handler.handle({
      jobId: 'job-1',
      tenantId: 't1',
      aggregateId: 'tpl-1',
      jobType: 'Recurring',
    });

    expect(executionRepository.skip).toHaveBeenCalledWith('exec-1', 'TemplateNotActive');
    expect(outboxWriter.append).not.toHaveBeenCalled();
  });
});
