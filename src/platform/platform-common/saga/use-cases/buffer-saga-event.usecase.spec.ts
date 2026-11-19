import { instance } from '@test/support/saga/saga.fixtures';
import { BufferSagaEventUseCase } from './buffer-saga-event.usecase';
import { AdvanceSagaUseCase } from './advance-saga.usecase';
import { SagaInboxPort } from '@platform/platform-common/saga-inbox/ports/saga-inbox.port';

/**
 * Unit — the saga inbox is the dedupe for WAIT events. A duplicate delivery must
 * not advance the instance twice, and the consumer key is per instance so two
 * instances of the same saga keep independent rows for the same event.
 */
describe('BufferSagaEventUseCase', () => {
  function makeSut() {
    const inbox = { buffer: jest.fn(async (): Promise<boolean> => true) };
    const advanceSaga = { execute: jest.fn(async () => instance()) };
    const useCase = new BufferSagaEventUseCase(
      inbox as unknown as SagaInboxPort,
      advanceSaga as unknown as AdvanceSagaUseCase,
    );
    return { useCase, inbox, advanceSaga };
  }

  const input = {
    instance: instance({ status: 'WAITING' as never }),
    eventId: 'evt-1',
    eventName: 'ap.bill.posted',
    eventVersion: 1,
    payload: { billId: 'bill-1' },
    payloadHash: 'hash-1',
  };

  it('buffers under a per-instance consumer key and advances', async () => {
    const { useCase, inbox, advanceSaga } = makeSut();

    await expect(useCase.execute(input)).resolves.toBe(true);

    expect(inbox.buffer).toHaveBeenCalledWith(
      expect.objectContaining({
        consumer: 'grn-to-invoice:instance-1',
        eventId: 'evt-1',
        correlationKey: 'GRN:grn-1',
        payloadHash: 'hash-1',
      }),
    );
    expect(inbox.buffer).toHaveBeenCalledTimes(1);
    expect(advanceSaga.execute).toHaveBeenCalledWith('instance-1');
  });

  it('returns false and does not advance on a duplicate delivery', async () => {
    const { useCase, inbox, advanceSaga } = makeSut();
    inbox.buffer.mockResolvedValue(false);

    await expect(useCase.execute(input)).resolves.toBe(false);

    expect(advanceSaga.execute).not.toHaveBeenCalled();
  });
});
