import { SagaInboxAdapter } from './saga-inbox.adapter';
import { BufferSagaInboxEventUseCase } from '../../use-cases/buffer-saga-inbox-event.usecase';
import { IgnoreBufferedSagaEventsUseCase } from '../../use-cases/ignore-buffered-saga-events.usecase';
import { ListBufferedSagaEventsUseCase } from '../../use-cases/list-buffered-saga-events.usecase';
import { MarkSagaEventConsumedUseCase } from '../../use-cases/mark-saga-event-consumed.usecase';
import { SagaInboxStatus } from '../../types/saga-inbox.types';

/**
 * Unit — the inbound adapter is the saga's whole view of `saga_inbox`.
 *
 * It must stay a pure delegation (rules live in the use cases) and it must keep
 * the three ledger transitions reachable: buffer → list → consume/ignore.
 */
describe('SagaInboxAdapter', () => {
  const REQUEST = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    consumer: 'grn-to-invoice:instance-1',
    eventId: 'evt-1',
    eventName: 'ap.bill.posted',
    eventVersion: 1,
    correlationKey: 'GRN:grn-1',
    instanceId: 'instance-1',
    payload: { billId: 'bill-1' },
    payloadHash: null,
  };

  const ROW = {
    id: 'inbox-1',
    ...REQUEST,
    correlationKey: 'GRN:grn-1',
    instanceId: 'instance-1',
    status: SagaInboxStatus.BUFFERED,
    attempts: 0,
    receivedAt: new Date(),
    nextAttemptAt: null,
    lastError: null,
  };

  function makeSut() {
    const bufferEvent = { execute: jest.fn(async () => true) };
    const listBufferedEvents = { execute: jest.fn(async () => [ROW]) };
    const markEventConsumed = { execute: jest.fn(async () => true) };
    const ignoreBufferedEvents = { execute: jest.fn(async () => 2) };
    const adapter = new SagaInboxAdapter(
      bufferEvent as unknown as BufferSagaInboxEventUseCase,
      listBufferedEvents as unknown as ListBufferedSagaEventsUseCase,
      markEventConsumed as unknown as MarkSagaEventConsumedUseCase,
      ignoreBufferedEvents as unknown as IgnoreBufferedSagaEventsUseCase,
    );
    return { adapter, bufferEvent, listBufferedEvents, markEventConsumed, ignoreBufferedEvents };
  }

  it('buffers through the use case and returns its dedupe verdict', async () => {
    const { adapter, bufferEvent } = makeSut();

    await expect(adapter.buffer(REQUEST)).resolves.toBe(true);

    expect(bufferEvent.execute).toHaveBeenCalledWith(REQUEST);
  });

  it('lists the buffered window for one event contract', async () => {
    const { adapter, listBufferedEvents } = makeSut();

    await expect(adapter.listBuffered('instance-1', 'ap.bill.posted', 1, 50)).resolves.toEqual([
      ROW,
    ]);

    expect(listBufferedEvents.execute).toHaveBeenCalledWith('instance-1', 'ap.bill.posted', 1, 50);
  });

  it('marks a consumed event and counts ignored ones', async () => {
    const { adapter, markEventConsumed, ignoreBufferedEvents } = makeSut();

    await expect(adapter.markConsumed('inbox-1')).resolves.toBe(true);
    await expect(
      adapter.ignoreBuffered('instance-1', 'ap.bill.posted', 1, 'WAIT timed out'),
    ).resolves.toBe(2);

    expect(markEventConsumed.execute).toHaveBeenCalledWith('inbox-1');
    expect(ignoreBufferedEvents.execute).toHaveBeenCalledWith(
      'instance-1',
      'ap.bill.posted',
      1,
      'WAIT timed out',
    );
  });
});
