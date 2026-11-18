import { SagaInboxRepositoryPort } from '../outbound/ports/saga-inbox.repository.port';
import { SagaInboxStatus } from '../types/saga-inbox.types';
import { BufferSagaInboxEventUseCase } from './buffer-saga-inbox-event.usecase';

/**
 * Unit — buffering a delivered saga event.
 *
 * The insert is the dedupe, so a redelivery must stop there: nothing is marked
 * BUFFERED and the caller is told `false` so the instance is not advanced twice.
 */
describe('BufferSagaInboxEventUseCase', () => {
  const INPUT = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    consumer: 'grn-to-invoice:instance-1',
    eventId: 'evt-1',
    eventName: 'ap.bill.posted',
    eventVersion: 1,
    correlationKey: 'GRN:grn-1',
    instanceId: 'instance-1',
    payload: { billId: 'bill-1' },
    payloadHash: 'hash-1',
  };

  function makeSut(insertedId: string | null = 'inbox-1') {
    const inbox = {
      tryInsert: jest.fn(async () => (insertedId ? { id: insertedId } : null)),
      markBuffered: jest.fn(async () => undefined),
    };
    const useCase = new BufferSagaInboxEventUseCase(inbox as unknown as SagaInboxRepositoryPort);
    return { useCase, inbox };
  }

  it('inserts the delivery under the instance consumer key and marks it BUFFERED', async () => {
    const { useCase, inbox } = makeSut();

    await expect(useCase.execute(INPUT)).resolves.toBe(true);

    expect(inbox.tryInsert).toHaveBeenCalledWith(INPUT);
    expect(inbox.markBuffered).toHaveBeenCalledWith('inbox-1', 'GRN:grn-1', 'instance-1');
  });

  it('reports a duplicate delivery without touching the row', async () => {
    const { useCase, inbox } = makeSut(null);

    await expect(useCase.execute(INPUT)).resolves.toBe(false);

    expect(inbox.markBuffered).not.toHaveBeenCalled();
  });

  it('keeps the status set stable for the ledger contract', () => {
    expect(Object.values(SagaInboxStatus)).toEqual(['RECEIVED', 'BUFFERED', 'CONSUMED', 'IGNORED']);
  });
});
