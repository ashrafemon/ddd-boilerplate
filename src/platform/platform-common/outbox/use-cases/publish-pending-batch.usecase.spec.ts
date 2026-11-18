import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PublishPendingBatchUseCase } from './publish-pending-batch.usecase';
import { OutboxRepositoryPort } from '../outbound/ports/outbox.repository.port';
import { UnsupportedBrokerTargetError } from '@platform/platform-common/messaging/inbound/ports/message-queue.port';
import { ClaimOutboxOptions, OutboxClaimedRecord, OutboxEnvelope } from '../types/outbox.types';

/**
 * Unit — the dispatch tick.
 *
 * A published message settles PUBLISHED; a broker error must leave the row
 * PENDING with backoff and never emit in-process; in-process failures are best
 * effort because the broker already has the message.
 */

const RECORD: OutboxClaimedRecord = {
  id: 'row-1',
  eventId: 'evt-1',
  tenantId: 'tenant-1',
  companyId: 'company-1',
  eventType: 'OrderCreated',
  eventVersion: 1,
  aggregateType: 'PurchaseOrder',
  aggregateId: 'order-1',
  payload: { orderId: 'order-1' },
  headers: { broker: 'kafka' },
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  aggregateVersion: 3,
  availableAt: null,
  status: 'PUBLISHING',
  attempts: 1,
  claimToken: 'claim-1',
  claimedAt: new Date('2026-01-01T00:00:10.000Z'),
  correlationId: 'corr-1',
  causationId: null,
};

function makeSut(records: OutboxClaimedRecord[] = [RECORD]) {
  const claimBatch = jest.fn<Promise<OutboxClaimedRecord[]>, [ClaimOutboxOptions]>();
  claimBatch.mockResolvedValue(records);
  const markPublished = jest.fn<Promise<void>, [string, string]>();
  markPublished.mockResolvedValue(undefined);
  const markFailed = jest.fn<Promise<void>, [string, string, string, Date, number]>();
  markFailed.mockResolvedValue(undefined);
  const markPermanentlyFailed = jest.fn<Promise<void>, [string, string, string]>();
  markPermanentlyFailed.mockResolvedValue(undefined);
  const repository = {
    claimBatch,
    markPublished,
    markFailed,
    markPermanentlyFailed,
  } as unknown as OutboxRepositoryPort;
  const publish = jest.fn<Promise<void>, [OutboxEnvelope]>();
  publish.mockResolvedValue(undefined);
  const emit = jest.fn<Promise<void>, [OutboxEnvelope]>();
  emit.mockResolvedValue(undefined);
  const messageQueue = { publish };
  const eventBus = { emit };
  const requestContext = { run: jest.fn((_ctx: unknown, fn: () => Promise<void>) => fn()) };
  const config = {
    getOutbox: () => ({
      batchSize: 100,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
      pollIntervalMs: 10_000,
      retryBackoffBaseMs: 1_000,
      retryMaxDelayMs: 600_000,
      cleanupOlderThanHours: 24,
    }),
  } as unknown as ConfigService;

  return {
    useCase: new PublishPendingBatchUseCase(
      repository,
      messageQueue,
      eventBus,
      requestContext as unknown as RequestContextPort,
      config,
    ),
    repository: { claimBatch, markPublished, markFailed, markPermanentlyFailed },
    messageQueue,
    eventBus,
    requestContext,
  };
}

describe('PublishPendingBatchUseCase', () => {
  it('publishes, emits in-process and settles PUBLISHED', async () => {
    const { useCase, repository, messageQueue, eventBus } = makeSut();

    const count = await useCase.execute();

    expect(count).toBe(1);
    const envelope = messageQueue.publish.mock.calls[0][0];
    expect(envelope).toMatchObject({
      eventId: 'evt-1',
      eventType: 'OrderCreated',
      aggregateType: 'PurchaseOrder',
      aggregateId: 'order-1',
      tenantId: 'tenant-1',
      broker: 'kafka',
    });
    expect(eventBus.emit).toHaveBeenCalledWith(envelope);
    expect(repository.markPublished).toHaveBeenCalledWith('row-1', 'claim-1');
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('runs the in-process emit with the message identity in scope', async () => {
    const { useCase, requestContext } = makeSut();

    await useCase.execute();

    expect(requestContext.run).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', companyId: 'company-1' }),
      expect.any(Function),
    );
  });

  it('keeps the row PENDING with backoff when the broker fails', async () => {
    const { useCase, repository, messageQueue, eventBus } = makeSut();
    messageQueue.publish.mockRejectedValue(new Error('broker down'));

    await useCase.execute();

    expect(repository.markPublished).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      'row-1',
      'claim-1',
      'broker down',
      expect.any(Date),
      10,
    );
  });

  it('doubles the backoff with each attempt', async () => {
    const { useCase, repository, messageQueue } = makeSut([{ ...RECORD, attempts: 4 }]);
    messageQueue.publish.mockRejectedValue(new Error('nope'));

    const before = Date.now();
    await useCase.execute();

    const retryAt = repository.markFailed.mock.calls[0][3];
    // base 1000ms * 2^(4-1) = 8000ms
    expect(retryAt.getTime() - before).toBeGreaterThanOrEqual(7_000);
  });

  it('parks a misconfiguration as FAILED instead of retrying it', async () => {
    const { useCase, repository, messageQueue, eventBus } = makeSut();
    messageQueue.publish.mockRejectedValue(
      new UnsupportedBrokerTargetError('KAFKA_BROKERS is not configured'),
    );

    await useCase.execute();

    expect(repository.markPermanentlyFailed).toHaveBeenCalledWith(
      'row-1',
      'claim-1',
      'KAFKA_BROKERS is not configured',
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('does not re-enter while a tick is still running', async () => {
    const { useCase, repository } = makeSut();
    let releaseFirst: () => void = () => undefined;
    repository.claimBatch.mockImplementation(
      () => new Promise<OutboxClaimedRecord[]>(resolve => (releaseFirst = () => resolve([RECORD]))),
    );

    const first = useCase.execute();
    const second = await useCase.execute();
    releaseFirst();
    const firstCount = await first;

    expect(second).toBe(0);
    expect(firstCount).toBe(1);
  });
});
