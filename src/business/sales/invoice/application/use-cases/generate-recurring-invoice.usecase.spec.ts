import { ConflictException } from '@nestjs/common';
import { GenerateRecurringInvoiceUseCase } from './generate-recurring-invoice.usecase';
import { LoggerPort } from '@platform/platform-common/observability/ports/logger.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { RecurringOccurrenceRequestedPayload } from '../../domain/types/recurring-occurrence.types';

describe('GenerateRecurringInvoiceUseCase', () => {
  const generation = { generateRecurringInvoice: jest.fn() };
  const execution = { findById: jest.fn(), complete: jest.fn(), fail: jest.fn() };
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
  const requestContext = { run: jest.fn() };
  let usecase: GenerateRecurringInvoiceUseCase;

  const command: RecurringOccurrenceRequestedPayload = {
    executionId: 'exec-1',
    recurringTemplateId: 'rt-1',
    targetEntityType: 'Invoice',
    partyId: 'c-1',
    partyType: 'CUSTOMER',
    currency: 'USD',
    autoPost: true,
    triggerKey: 'key',
    traceId: 'trace',
    headerOverrides: null,
    lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.run.mockImplementation((_ctx: unknown, fn: () => Promise<void>) => fn());
    execution.findById.mockResolvedValue({ status: 'IN_PROGRESS' });
    generation.generateRecurringInvoice.mockResolvedValue({
      invoiceId: 'inv-1',
      snapshot: { total: 10 },
    });
    usecase = new GenerateRecurringInvoiceUseCase(
      generation,
      execution,
      logger as unknown as LoggerPort,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('ignores occurrences for another target entity', async () => {
    await usecase.execute({ ...command, targetEntityType: 'PurchaseOrder' });
    expect(generation.generateRecurringInvoice).not.toHaveBeenCalled();
  });

  it('requires an execution id', async () => {
    await expect(usecase.execute({ ...command, executionId: '' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires a customer party id', async () => {
    await expect(usecase.execute({ ...command, partyId: null })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('skips when the execution is missing', async () => {
    execution.findById.mockResolvedValue(null);
    await usecase.execute(command);
    expect(logger.warn).toHaveBeenCalled();
    expect(execution.complete).not.toHaveBeenCalled();
  });

  it('generates and completes the execution', async () => {
    await usecase.execute(command);
    expect(generation.generateRecurringInvoice).toHaveBeenCalledWith(
      'c-1',
      'USD',
      [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
      true,
    );
    expect(execution.complete).toHaveBeenCalledWith(
      'exec-1',
      expect.objectContaining({ generatedDocumentId: 'inv-1', generatedSnapshot: { total: 10 } }),
    );
  });

  it('marks the execution failed when generation throws', async () => {
    generation.generateRecurringInvoice.mockRejectedValue(new Error('boom'));
    await usecase.execute(command);
    expect(execution.fail).toHaveBeenCalledWith('exec-1', 'boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
