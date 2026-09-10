import { ConfigService } from '@config/config.service';
import { BatchOperationWorker } from './batch-operation.worker';
import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { ProcessBatchOperationRowUseCase } from './usecases/process-batch-operation-row.usecase';
import { InMemoryBatchOperationJobRepository } from './__testing__/in-memory-batch-operation-job.repository';
import { BatchOperationHandler } from './ports/batch-operation-handler.port';
import { BatchOperationJobOutboxWriterPort } from './ports/batch-operation-job-outbox-writer.port';
import { BatchOperationDispatch } from './batch-operation.types';

const config = {
  getBatchOperation: () => ({
    maxRecordsPerJob: 5_000,
    syncThreshold: 20,
    chunkSize: 50,
    workerConcurrency: 5,
    chunkAttempts: 3,
    reconciliationWindowMs: 300_000,
    resultSnapshotMaxBytes: 65_536,
  }),
} as unknown as ConfigService;

async function seed(repo: InMemoryBatchOperationJobRepository, entityIds: string[]) {
  const job = await repo.createJobWithRows(
    {
      jobNo: 'BATCH-000001',
      aggregateType: 'Invoice',
      operationCode: 'approve',
      operationParams: null,
      mode: 'SYNC',
      status: 'RUNNING',
      tenantId: 't1',
      companyId: null,
      branchId: null,
      requestedBy: 'u1',
    },
    entityIds,
  );
  const dispatch: BatchOperationDispatch = {
    jobId: job.id,
    aggregateType: 'Invoice',
    operationCode: 'approve',
    params: undefined,
    tenantId: 't1',
    requestedBy: 'u1',
    traceId: undefined,
    rowIds: (job.rows ?? []).map(r => r.id),
  };
  return { job, dispatch };
}

function makeWorker(
  repo: InMemoryBatchOperationJobRepository,
  registry: BatchOperationHandlerRegistry,
  outbox?: BatchOperationJobOutboxWriterPort,
) {
  const processRow = new ProcessBatchOperationRowUseCase(repo, repo, registry, config);
  const outboxWriter: BatchOperationJobOutboxWriterPort = outbox ?? {
    writeJobCompletedEvent: jest.fn().mockResolvedValue(undefined),
  };
  return new BatchOperationWorker(repo, repo, processRow, outboxWriter);
}

describe('BatchOperationWorker.processChunk', () => {
  it('records SUCCESS / SKIPPED / FAILED per row and finalises the job as COMPLETED_WITH_ERRORS', async () => {
    const repo = new InMemoryBatchOperationJobRepository();
    const registry = new BatchOperationHandlerRegistry();
    const handler: BatchOperationHandler = {
      supportedOperations: () => ['approve'],
      validate: entityId =>
        Promise.resolve(
          entityId === 'skip-me'
            ? { canProceed: false, reason: 'ALREADY_IN_TARGET_STATE' }
            : { canProceed: true },
        ),
      execute: entityId => {
        if (entityId === 'fail-me') return Promise.reject(new Error('downstream boom'));
        return Promise.resolve({ resultSnapshot: { ok: entityId } });
      },
    };
    registry.register('Invoice', ['approve'], handler);
    const writeJobCompletedEvent = jest.fn().mockResolvedValue(undefined);
    const worker = makeWorker(repo, registry, { writeJobCompletedEvent });

    const { job, dispatch } = await seed(repo, ['ok-1', 'skip-me', 'fail-me']);
    await worker.processChunk(dispatch);

    const finished = await repo.findJobWithRows(job.id);
    expect(finished?.status).toBe('COMPLETED_WITH_ERRORS');
    expect(finished?.successRecords).toBe(1);
    expect(finished?.skippedRecords).toBe(1);
    expect(finished?.failedRecords).toBe(1);
    expect(finished?.processedRecords).toBe(3);
    const byEntity = Object.fromEntries((finished?.rows ?? []).map(r => [r.entityId, r.status]));
    expect(byEntity).toEqual({ 'ok-1': 'SUCCESS', 'skip-me': 'SKIPPED', 'fail-me': 'FAILED' });
    expect(writeJobCompletedEvent).toHaveBeenCalledTimes(1);
  });

  it('finalises an all-success job as COMPLETED', async () => {
    const repo = new InMemoryBatchOperationJobRepository();
    const registry = new BatchOperationHandlerRegistry();
    registry.register('Invoice', ['approve'], {
      supportedOperations: () => ['approve'],
      validate: () => Promise.resolve({ canProceed: true }),
      execute: () => Promise.resolve({}),
    });
    const worker = makeWorker(repo, registry);

    const { job, dispatch } = await seed(repo, ['a', 'b']);
    await worker.processChunk(dispatch);

    expect((await repo.findJob(job.id))?.status).toBe('COMPLETED');
  });

  it('skips a row that another delivery already claimed (claim returns null)', async () => {
    const repo = new InMemoryBatchOperationJobRepository();
    const registry = new BatchOperationHandlerRegistry();
    const execute = jest.fn().mockResolvedValue({});
    registry.register('Invoice', ['approve'], {
      supportedOperations: () => ['approve'],
      validate: () => Promise.resolve({ canProceed: true }),
      execute,
    });
    const worker = makeWorker(repo, registry);

    const { dispatch } = await seed(repo, ['a', 'b']);
    for (const rowId of dispatch.rowIds) {
      await repo.claimRow(rowId);
      await repo.markRowSuccess(rowId, null, 1);
    }

    await worker.processChunk(dispatch);
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops claiming rows once cancel is requested', async () => {
    const repo = new InMemoryBatchOperationJobRepository();
    const registry = new BatchOperationHandlerRegistry();
    const execute = jest.fn().mockResolvedValue({});
    registry.register('Invoice', ['approve'], {
      supportedOperations: () => ['approve'],
      validate: () => Promise.resolve({ canProceed: true }),
      execute,
    });
    const worker = makeWorker(repo, registry);

    const { job, dispatch } = await seed(repo, ['a', 'b', 'c']);
    await repo.setCancelRequested(job.id);

    await worker.processChunk(dispatch);
    expect(execute).not.toHaveBeenCalled();
    expect((await repo.findJob(job.id))?.status).toBe('CANCELLED');
  });
});
