import { RecurringOccurrenceRequestedRabbitMQListener } from './recurring-occurrence-requested.listener';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { GenerateRecurringInvoiceUseCase } from '../../../application/use-cases/generate-recurring-invoice.usecase';
import { OutboxEnvelope } from '@platform/platform-common/outbox/outbox.types';

const envelope = (payload: Record<string, unknown>): OutboxEnvelope => ({
  eventId: 'evt-1',
  eventType: 'RecurringOccurrenceRequested',
  tenantId: 'tenant-1',
  companyId: 'company-1',
  aggregateType: 'RecurringTemplate',
  aggregateId: 'rt-1',
  payload,
  occurredAt: new Date(),
});

const invoicePayload = {
  executionId: 'exec-1',
  targetEntityType: 'Invoice',
  partyId: 'c-1',
  lines: [],
};

describe('RecurringOccurrenceRequestedRabbitMQListener', () => {
  const inbox = { receive: jest.fn(), complete: jest.fn(), fail: jest.fn() };
  const generate = { execute: jest.fn() };
  const requestContext = { run: jest.fn() };
  let listener: RecurringOccurrenceRequestedRabbitMQListener;

  beforeEach(() => {
    jest.clearAllMocks();
    requestContext.run.mockImplementation((_ctx: unknown, fn: () => Promise<void>) => fn());
    inbox.receive.mockResolvedValue({ status: 'ACQUIRED', reservation: 'r-1' });
    listener = new RecurringOccurrenceRequestedRabbitMQListener(
      generate as unknown as GenerateRecurringInvoiceUseCase,
      inbox,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('ignores other event types', async () => {
    await listener.onRecurringOccurrenceRequested({
      ...envelope(invoicePayload),
      eventType: 'PurchaseOrderCreated',
    });
    expect(inbox.receive).not.toHaveBeenCalled();
  });

  it('ignores other target entities', async () => {
    await listener.onRecurringOccurrenceRequested(
      envelope({ ...invoicePayload, targetEntityType: 'PurchaseOrder' }),
    );
    expect(inbox.receive).not.toHaveBeenCalled();
  });

  it('skips duplicate deliveries', async () => {
    inbox.receive.mockResolvedValue({ status: 'DUPLICATE' });
    await listener.onRecurringOccurrenceRequested(envelope(invoicePayload));
    expect(generate.execute).not.toHaveBeenCalled();
  });

  it('generates an invoice for acquired deliveries', async () => {
    await listener.onRecurringOccurrenceRequested(envelope(invoicePayload));
    expect(generate.execute).toHaveBeenCalledWith(invoicePayload);
    expect(inbox.complete).toHaveBeenCalledWith({ reservation: 'r-1' });
  });

  it('fails the inbox reservation and rethrows on handler errors', async () => {
    generate.execute.mockRejectedValue(new Error('boom'));
    await expect(listener.onRecurringOccurrenceRequested(envelope(invoicePayload))).rejects.toThrow(
      'boom',
    );
    expect(inbox.fail).toHaveBeenCalledWith({ reservation: 'r-1', lastError: 'boom' });
  });
});
