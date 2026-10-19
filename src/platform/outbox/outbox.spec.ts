import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { RequestContext } from '@platform/context/ports/request-context';
import { PrismaOutboxRepository } from './repositories/prisma-outbox.repository';
import { AppendOutboxEventUseCase } from './usecases/append-outbox-event.usecase';
import { PublishPendingBatchUseCase } from './usecases/publish-pending-batch.usecase';
import { OutboxService } from './services/outbox.service';
import {
  AppendOutboxEventRequest,
  OutboxClaimedRecord,
  OutboxEnvelope,
  OutboxEvent,
} from './outbox.types';

class SalesOrderCreated implements OutboxEvent {
  readonly eventId = 'evt-1';
  readonly occurredAt = new Date('2026-01-01T00:00:00.000Z');
  readonly version = 1;
  constructor(public readonly orderId: string) {}
}

function context(): RequestContext {
  return RequestContext.create({
    requestId: 'req-1',
    correlationId: 'corr-1',
    tenantId: 't1',
    organizationId: 'o1',
    roles: [],
    locale: 'en',
  });
}

function makeRecord(overrides: Partial<OutboxClaimedRecord> = {}): OutboxClaimedRecord {
  return {
    id: 'ob-1',
    eventId: 'evt-1',
    tenantId: 't1',
    organizationId: 'o1',
    eventType: 'SalesOrderCreated',
    eventVersion: 1,
    aggregateType: 'SalesOrder',
    aggregateId: 'order-1',
    payload: { orderId: 'order-1' },
    headers: null,
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'PENDING',
    attempts: 1,
    claimToken: 'ct-1',
    claimedAt: new Date('2026-01-01T00:00:00.000Z'),
    correlationId: 'corr-1',
    causationId: null,
    ...overrides,
  };
}

describe('AppendOutboxEventUseCase', () => {
  let append: jest.Mock;
  let useCase: AppendOutboxEventUseCase;

  beforeEach(() => {
    append = jest.fn().mockResolvedValue(undefined);
    const requestContext = { get: jest.fn().mockReturnValue(context()) };
    useCase = new AppendOutboxEventUseCase(
      { append } as unknown as PrismaOutboxRepository,
      requestContext as unknown as RequestContextPort,
    );
  });

  it('stores the event with a stable envelope identity and a broker header', async () => {
    await useCase.execute(new SalesOrderCreated('order-1'), 'SalesOrder', 'order-1');

    const [[request]] = append.mock.calls as [[AppendOutboxEventRequest]];
    expect(request.eventId).toBe('evt-1');
    expect(request.eventType).toBe('SalesOrderCreated');
    expect(request.aggregateType).toBe('SalesOrder');
    expect(request.aggregateId).toBe('order-1');
    expect(request.tenantId).toBe('t1');
    expect(request.organizationId).toBe('o1');
    expect(request.correlationId).toBe('corr-1');
    expect(request.broker).toBe('rabbitmq');
    expect(request.headers?.['event-id']).toBe('evt-1');
    expect(request.headers?.['broker']).toBe('rabbitmq');
    // envelope fields are stripped from the payload
    expect(request.payload).toEqual({
      orderId: 'order-1',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('honours opts.broker', async () => {
    await useCase.execute(new SalesOrderCreated('order-1'), 'SalesOrder', 'order-1', {
      broker: 'kafka',
    });

    const [[request]] = append.mock.calls as [[AppendOutboxEventRequest]];
    expect(request.broker).toBe('kafka');
    expect(request.headers?.['broker']).toBe('kafka');
  });
});

describe('OutboxService', () => {
  it('delegates append to the use case', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const service = new OutboxService({ execute } as unknown as AppendOutboxEventUseCase);

    const event = new SalesOrderCreated('order-1');
    await service.append(event, 'SalesOrder', 'order-1', { broker: 'sqs' });

    expect(execute).toHaveBeenCalledWith(event, 'SalesOrder', 'order-1', { broker: 'sqs' });
  });
});

describe('PublishPendingBatchUseCase', () => {
  let claimBatch: jest.Mock;
  let markPublished: jest.Mock;
  let markFailed: jest.Mock;
  let publish: jest.Mock;
  let emit: jest.Mock;
  let messageQueue: { publish: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let useCase: PublishPendingBatchUseCase;

  beforeEach(() => {
    claimBatch = jest.fn().mockResolvedValue([]);
    markPublished = jest.fn().mockResolvedValue(undefined);
    markFailed = jest.fn().mockResolvedValue(undefined);
    publish = jest.fn().mockResolvedValue(undefined);
    emit = jest.fn();

    messageQueue = { publish };
    eventBus = { emit };

    const repository = { claimBatch, markPublished, markFailed };
    const requestContext = {
      run: jest.fn((_patch: unknown, fn: () => unknown) => Promise.resolve(fn())),
    };
    const config = {
      getOutbox: () => ({
        pollIntervalMs: 10_000,
        batchSize: 100,
        maxAttempts: 10,
        retryBackoffBaseMs: 1_000,
        retryMaxDelayMs: 600_000,
        claimLeaseMs: 60_000,
        cleanupOlderThanHours: 24,
      }),
    };

    useCase = new PublishPendingBatchUseCase(
      repository as unknown as PrismaOutboxRepository,
      messageQueue,
      eventBus,
      requestContext as unknown as RequestContextPort,
      config as unknown as ConfigService,
    );
  });

  it('publishes then emits then marks PUBLISHED', async () => {
    claimBatch.mockResolvedValue([makeRecord()]);

    const count = await useCase.execute();

    expect(count).toBe(1);
    const [[envelope]] = publish.mock.calls as [[OutboxEnvelope]];
    expect(envelope.eventType).toBe('SalesOrderCreated');
    expect(envelope.eventId).toBe('evt-1');
    expect(envelope.broker).toBe('rabbitmq');
    expect(emit).toHaveBeenCalledWith(envelope);
    expect(markPublished).toHaveBeenCalledWith('ob-1', 'ct-1');
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('routes on the broker stored in headers', async () => {
    claimBatch.mockResolvedValue([makeRecord({ headers: { broker: 'kafka' } })]);

    await useCase.execute();

    const [[envelope]] = publish.mock.calls as [[OutboxEnvelope]];
    expect(envelope.broker).toBe('kafka');
  });

  it('keeps the row retryable when the broker publish fails', async () => {
    claimBatch.mockResolvedValue([makeRecord()]);
    publish.mockRejectedValue(new Error('broker down'));

    await useCase.execute();

    expect(markPublished).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    const [[id, token, error, nextRetryAt, maxAttempts]] = markFailed.mock.calls as [
      [string, string, string, Date, number],
    ];
    expect(id).toBe('ob-1');
    expect(token).toBe('ct-1');
    expect(error).toBe('broker down');
    expect(nextRetryAt.getTime()).toBeGreaterThan(Date.now() - 1);
    expect(maxAttempts).toBe(10);
  });

  it('does not fail the row when an in-process listener throws', async () => {
    claimBatch.mockResolvedValue([makeRecord()]);
    emit.mockImplementation(() => {
      throw new Error('listener blew up');
    });

    await useCase.execute();

    expect(markPublished).toHaveBeenCalledWith('ob-1', 'ct-1');
    expect(markFailed).not.toHaveBeenCalled();
  });
});
