import { ConfigService } from '@config/config.service';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { CreateBatchOperationJobUseCase } from './create-batch-operation-job.usecase';
import { BatchOperationHandlerRegistry } from '../batch-operation-handler.registry';
import { BatchOperationWorker } from '../batch-operation.worker';
import { BatchOperationQueuePublisherPort } from '../ports/batch-operation-queue-publisher.port';
import { InMemoryBatchOperationJobRepository } from '../__testing__/in-memory-batch-operation-job.repository';
import {
  BatchSelectionTooLargeError,
  EmptyBatchSelectionError,
  UnregisteredBatchHandlerError,
  UnsupportedBatchOperationError,
} from '../batch-operation.errors';

function makeSut(overrides?: { syncThreshold?: number; maxRecordsPerJob?: number }) {
  const repo = new InMemoryBatchOperationJobRepository();
  const registry = new BatchOperationHandlerRegistry();
  registry.register('Invoice', ['approve', 'post'], {
    supportedOperations: () => ['approve', 'post'],
    validate: () => Promise.resolve({ canProceed: true }),
    execute: () => Promise.resolve({}),
  });
  const processChunk = jest.fn().mockResolvedValue(undefined);
  const worker = { processChunk } as unknown as BatchOperationWorker;
  const dispatchChunks = jest.fn().mockResolvedValue(undefined);
  const queuePublisher = { dispatchChunks } as unknown as BatchOperationQueuePublisherPort;
  const numbering: NumberingPort = { nextNumber: jest.fn().mockResolvedValue('BATCH-000001') };
  const config = {
    getBatchOperation: () => ({
      maxRecordsPerJob: overrides?.maxRecordsPerJob ?? 5_000,
      syncThreshold: overrides?.syncThreshold ?? 20,
      chunkSize: 50,
      workerConcurrency: 5,
      chunkAttempts: 3,
      reconciliationWindowMs: 300_000,
      resultSnapshotMaxBytes: 65_536,
    }),
  } as unknown as ConfigService;

  const sut = new CreateBatchOperationJobUseCase(
    repo,
    registry,
    worker,
    queuePublisher,
    numbering,
    config,
  );
  return { sut, repo, processChunk, dispatchChunks };
}

describe('CreateBatchOperationJobUseCase', () => {
  it('runs SYNC and awaits the worker when the selection is at or below the threshold', async () => {
    const { sut, processChunk, dispatchChunks, repo } = makeSut({ syncThreshold: 3 });

    const job = await sut.execute({
      aggregateType: 'Invoice',
      operationCode: 'approve',
      entityIds: ['a', 'b', 'c'],
    });

    expect(job.mode).toBe('SYNC');
    expect(job.status).toBe('RUNNING');
    expect(job.totalRecords).toBe(3);
    expect(processChunk).toHaveBeenCalledTimes(1);
    expect(dispatchChunks).not.toHaveBeenCalled();
    expect(repo.jobs.size).toBe(1);
    expect([...repo.rows.values()]).toHaveLength(3);
  });

  it('runs ASYNC and enqueues chunks above the threshold', async () => {
    const { sut, processChunk, dispatchChunks } = makeSut({ syncThreshold: 2 });

    const job = await sut.execute({
      aggregateType: 'Invoice',
      operationCode: 'approve',
      entityIds: ['a', 'b', 'c'],
    });

    expect(job.mode).toBe('ASYNC');
    expect(job.status).toBe('PENDING');
    expect(dispatchChunks).toHaveBeenCalledTimes(1);
    expect(processChunk).not.toHaveBeenCalled();
  });

  it('de-duplicates entityIds before creating rows', async () => {
    const { sut, repo } = makeSut();

    const job = await sut.execute({
      aggregateType: 'Invoice',
      operationCode: 'approve',
      entityIds: ['a', 'a', 'b', '', '  '],
    });

    expect(job.totalRecords).toBe(2);
    expect([...repo.rows.values()]).toHaveLength(2);
  });

  it('rejects an unknown aggregateType, an unsupported operation, an empty or oversized selection', async () => {
    const { sut } = makeSut({ maxRecordsPerJob: 2 });

    await expect(
      sut.execute({ aggregateType: 'Ghost', operationCode: 'approve', entityIds: ['a'] }),
    ).rejects.toBeInstanceOf(UnregisteredBatchHandlerError);

    await expect(
      sut.execute({ aggregateType: 'Invoice', operationCode: 'delete', entityIds: ['a'] }),
    ).rejects.toBeInstanceOf(UnsupportedBatchOperationError);

    await expect(
      sut.execute({ aggregateType: 'Invoice', operationCode: 'approve', entityIds: [] }),
    ).rejects.toBeInstanceOf(EmptyBatchSelectionError);

    await expect(
      sut.execute({
        aggregateType: 'Invoice',
        operationCode: 'approve',
        entityIds: ['a', 'b', 'c'],
      }),
    ).rejects.toBeInstanceOf(BatchSelectionTooLargeError);
  });
});
