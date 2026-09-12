import { InvoiceId } from '../../domain/value-objects/invoice-id.vo';
import { RecurringOccurrenceRequestedPayload } from '../integrations/recurring-occurrence.types';
import { GenerateRecurringInvoiceUseCase } from './generate-recurring-invoice.usecase';

describe('GenerateRecurringInvoiceUseCase', () => {
  const createInvoice = { execute: jest.fn() };
  const getInvoice = { execute: jest.fn() };
  const postInvoice = { execute: jest.fn() };
  const recurringExecution = {
    findById: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
  const useCase = new GenerateRecurringInvoiceUseCase(
    createInvoice,
    getInvoice,
    postInvoice,
    recurringExecution,
    logger,
  );
  const command: RecurringOccurrenceRequestedPayload = {
    executionId: 'exec-1',
    recurringTemplateId: 'tpl-1',
    targetEntityType: 'Invoice',
    partyId: 'cust-1',
    partyType: 'CUSTOMER',
    currency: 'USD',
    autoPost: false,
    triggerKey: '2026-10-01',
    traceId: 'trace-1',
    headerOverrides: null,
    lines: [{ description: 'Retainer', quantity: 1, unitPrice: 500 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    recurringExecution.findById.mockResolvedValue({ id: 'exec-1', status: 'IN_PROGRESS' });
    createInvoice.execute.mockResolvedValue(InvoiceId.fromString('inv-1'));
    getInvoice.execute.mockResolvedValue({ id: 'inv-1', invoiceNo: 'INV-1' });
  });

  it('creates the invoice and completes the recurring execution', async () => {
    await useCase.execute(command);

    expect(createInvoice.execute).toHaveBeenCalledWith({
      customerId: 'cust-1',
      currency: 'USD',
      lines: [{ description: 'Retainer', quantity: 1, unitPrice: 500 }],
    });
    expect(recurringExecution.complete).toHaveBeenCalledWith(
      'exec-1',
      expect.objectContaining({ generatedDocumentId: 'inv-1' }),
    );
    expect(postInvoice.execute).not.toHaveBeenCalled();
  });

  it('is idempotent when the execution is already SUCCESS', async () => {
    recurringExecution.findById.mockResolvedValue({ id: 'exec-1', status: 'SUCCESS' });

    await useCase.execute(command);

    expect(createInvoice.execute).not.toHaveBeenCalled();
    expect(recurringExecution.complete).not.toHaveBeenCalled();
  });

  it('fails the execution when create throws, without nacking the message', async () => {
    createInvoice.execute.mockRejectedValue(new Error('customer inactive'));

    await useCase.execute(command);

    expect(recurringExecution.fail).toHaveBeenCalledWith('exec-1', 'customer inactive');
    expect(recurringExecution.complete).not.toHaveBeenCalled();
  });

  it('posts the invoice when autoPost is true', async () => {
    await useCase.execute({ ...command, autoPost: true });

    expect(postInvoice.execute).toHaveBeenCalledWith('inv-1');
  });

  it('ignores occurrences for other target entity types', async () => {
    await useCase.execute({ ...command, targetEntityType: 'PurchaseOrder' });

    expect(recurringExecution.findById).not.toHaveBeenCalled();
    expect(createInvoice.execute).not.toHaveBeenCalled();
  });
});
