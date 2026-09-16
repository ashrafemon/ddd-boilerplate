import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { InvoiceFactory } from '../../domain/factories/invoice.factory';
import { InvoiceStatus } from '../../domain/types/invoice.enum';
import { InvoiceQuery } from '../queries/invoice.query';
import { InvoiceIntegrationPort } from '../integrations/publishes/invoice.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { RecurringExecutionPort } from '@platform/recurring/ports/recurring-execution.port';
import { LoggerPort } from '@platform/observability/ports/logger.port';
import { RecurringOccurrenceRequestedPayload } from '../integrations/recurring-occurrence.types';
import { CreateInvoiceUseCase } from './create-invoice.usecase';
import { GenerateRecurringInvoiceUseCase } from './generate-recurring-invoice.usecase';
import { GetInvoiceUseCase } from './get-invoice.usecase';
import { PostInvoiceUseCase } from './post-invoice.usecase';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

describe('GenerateRecurringInvoiceUseCase', () => {
  const save = jest.fn<Promise<Invoice>, [Invoice]>();
  const update = jest.fn<Promise<Invoice>, [Invoice]>();
  const findById = jest.fn<Promise<Invoice | null>, [string]>();
  const invoiceRepository: InvoiceCommandRepository = { findById, save, update };
  const integration: InvoiceIntegrationPort = { send: jest.fn().mockResolvedValue(undefined) };
  const companyConfig: CompanyConfigPort = {
    getCompanyConfig: jest.fn().mockResolvedValue({
      companyId: 'c1',
      companyCode: 'CC',
      companyName: 'Co',
      defaultCurrency: 'USD',
      autoApproveThreshold: 10000,
      isActive: true,
    }),
  };
  const numbering: NumberingPort = { nextNumber: jest.fn().mockResolvedValue('INV-00000001') };
  const query: InvoiceQuery = {
    findById: jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNo: 'INV-00000001' }),
    findAll: jest.fn(),
  };

  const execution = {
    findById: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
  const executionPort: RecurringExecutionPort = execution;
  const logger: LoggerPort = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  const useCase = new GenerateRecurringInvoiceUseCase(
    new CreateInvoiceUseCase(invoiceRepository, integration, companyConfig, numbering),
    new GetInvoiceUseCase(query),
    new PostInvoiceUseCase(invoiceRepository, integration),
    executionPort,
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
    initNoopTransactionHost();
    numbering.nextNumber = jest.fn().mockResolvedValue('INV-00000001');
    companyConfig.getCompanyConfig = jest.fn().mockResolvedValue({
      companyId: 'c1',
      companyCode: 'CC',
      companyName: 'Co',
      defaultCurrency: 'USD',
      autoApproveThreshold: 10000,
      isActive: true,
    });
    integration.send = jest.fn().mockResolvedValue(undefined);
    execution.findById.mockResolvedValue({ id: 'exec-1', status: 'IN_PROGRESS' });
    save.mockImplementation(invoice => Promise.resolve(invoice));
    update.mockImplementation(invoice => Promise.resolve(invoice));
    query.findById = jest.fn().mockResolvedValue({ id: 'inv-1', invoiceNo: 'INV-00000001' });
  });

  it('creates the invoice and completes the recurring execution', async () => {
    await useCase.execute(command);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]?.[0];
    expect(saved.customerId).toBe('cust-1');
    expect(execution.complete).toHaveBeenCalledWith(
      'exec-1',
      expect.objectContaining({ generatedDocumentId: saved.id.toString() }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('is idempotent when the execution is already SUCCESS', async () => {
    execution.findById.mockResolvedValue({ id: 'exec-1', status: 'SUCCESS' });

    await useCase.execute(command);

    expect(save).not.toHaveBeenCalled();
    expect(execution.complete).not.toHaveBeenCalled();
  });

  it('fails the execution when creation throws, without nacking the message', async () => {
    numbering.nextNumber = jest.fn().mockRejectedValue(new Error('sequence unavailable'));

    await useCase.execute(command);

    expect(execution.fail).toHaveBeenCalledWith('exec-1', 'sequence unavailable');
    expect(execution.complete).not.toHaveBeenCalled();
  });

  it('posts the invoice when autoPost is true', async () => {
    findById.mockImplementation(() =>
      Promise.resolve(
        InvoiceFactory.create({
          invoiceNo: 'INV-00000001',
          customerId: 'cust-1',
          currency: 'USD',
          lines: [{ description: 'Retainer', quantity: 1, unitPrice: 500 }],
        }),
      ),
    );

    await useCase.execute({ ...command, autoPost: true });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0].status).toBe(InvoiceStatus.POSTED);
  });

  it('ignores occurrences for other target entity types', async () => {
    await useCase.execute({ ...command, targetEntityType: 'PurchaseOrder' });

    expect(execution.findById).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
