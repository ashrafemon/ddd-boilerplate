import { ConfigService } from '@config/config.service';
import { PublishPendingBatchUseCase } from './publish-pending-batch.usecase';
import { PublishPendingBatchService } from '../services/publish-pending-batch.service';
import { PrismaOutboxRepository } from '../repositories/prisma-outbox.repository';
import { ClaimOutboxOptions, OutboxClaimedRecord } from '../types/outbox.types';

/**
 * Unit — the dispatch tick.
 *
 * The use case claims a batch (SKIP LOCKED + lease) and fans each row out to
 * `PublishPendingBatchService`. Per-row publish/emit/settle behaviour is
 * covered by the service's own spec.
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
  const repository = { claimBatch } as unknown as PrismaOutboxRepository;

  const dispatchOne = jest.fn<Promise<void>, [OutboxClaimedRecord, number]>();
  dispatchOne.mockResolvedValue(undefined);
  const dispatch = { dispatchOne } as unknown as PublishPendingBatchService;

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
    useCase: new PublishPendingBatchUseCase(repository, dispatch, config),
    repository: { claimBatch },
    dispatch: { dispatchOne },
  };
}

describe('PublishPendingBatchUseCase', () => {
  it('claims a batch and fans each row out to the dispatch service', async () => {
    const { useCase, dispatch, repository } = makeSut();

    const count = await useCase.execute();

    expect(count).toBe(1);
    expect(repository.claimBatch).toHaveBeenCalledWith({
      batchSize: 100,
      maxAttempts: 10,
      claimLeaseMs: 60_000,
    });
    expect(dispatch.dispatchOne).toHaveBeenCalledWith(RECORD, 10);
  });

  it('returns zero and calls no dispatcher when the batch is empty', async () => {
    const { useCase, dispatch } = makeSut([]);

    const count = await useCase.execute();

    expect(count).toBe(0);
    expect(dispatch.dispatchOne).not.toHaveBeenCalled();
  });
});
