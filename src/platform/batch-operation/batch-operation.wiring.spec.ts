import { Test } from '@nestjs/testing';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { BatchOperationWorker } from './batch-operation.worker';
import { BatchOperationJobRepositoryPort } from './ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from './ports/batch-operation-job-row-repository.port';
import { BatchOperationQueuePublisherPort } from './ports/batch-operation-queue-publisher.port';
import { BatchOperationJobOutboxWriterPort } from './ports/batch-operation-job-outbox-writer.port';
import { CreateBatchOperationJobPort } from './ports/create-batch-operation-job.port';
import { ProcessBatchOperationRowPort } from './ports/process-batch-operation-row.port';
import { ValidateBatchOperationPort } from './ports/validate-batch-operation.port';
import { GetBatchOperationJobStatusPort } from './ports/get-batch-operation-job-status.port';
import { ListBatchOperationJobsPort } from './ports/list-batch-operation-jobs.port';
import { ListBatchOperationJobRowsPort } from './ports/list-batch-operation-job-rows.port';
import { CancelBatchOperationJobPort } from './ports/cancel-batch-operation-job.port';
import { CreateBatchOperationJobUseCase } from './usecases/create-batch-operation-job.usecase';
import { ProcessBatchOperationRowUseCase } from './usecases/process-batch-operation-row.usecase';
import { ValidateBatchOperationUseCase } from './usecases/validate-batch-operation.usecase';
import { GetBatchOperationJobStatusUseCase } from './usecases/get-batch-operation-job-status.usecase';
import { ListBatchOperationJobsUseCase } from './usecases/list-batch-operation-jobs.usecase';
import { ListBatchOperationJobRowsUseCase } from './usecases/list-batch-operation-job-rows.usecase';
import { CancelBatchOperationJobUseCase } from './usecases/cancel-batch-operation-job.usecase';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { BatchOperationController } from './http/batch-operation.controller';
import { InMemoryBatchOperationJobRepository } from './__testing__/in-memory-batch-operation-job.repository';

const configStub = {
  getBatchOperation: () => ({
    maxRecordsPerJob: 5_000,
    syncThreshold: 20,
    chunkSize: 50,
    workerConcurrency: 5,
    chunkAttempts: 3,
    reconciliationWindowMs: 300_000,
    resultSnapshotMaxBytes: 65_536,
  }),
};

/**
 * Resolves the whole batch-operation provider graph through Nest's DI the same
 * way PlatformModule wires it — a provider-resolution error here would
 * otherwise only surface at app boot (which needs a database).
 */
describe('batch-operation DI wiring', () => {
  it('resolves the controller and runs a Sync submit end-to-end against an in-memory repository', async () => {
    const repo = new InMemoryBatchOperationJobRepository();
    const moduleRef = await Test.createTestingModule({
      controllers: [BatchOperationController],
      providers: [
        { provide: BatchOperationJobRepositoryPort, useValue: repo },
        { provide: BatchOperationJobRowRepositoryPort, useValue: repo },
        {
          provide: BatchOperationQueuePublisherPort,
          useValue: { dispatchChunks: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: BatchOperationJobOutboxWriterPort,
          useValue: { writeJobCompletedEvent: jest.fn().mockResolvedValue(undefined) },
        },
        BatchOperationHandlerRegistry,
        ProcessBatchOperationRowUseCase,
        { provide: ProcessBatchOperationRowPort, useExisting: ProcessBatchOperationRowUseCase },
        BatchOperationWorker,
        CreateBatchOperationJobUseCase,
        { provide: CreateBatchOperationJobPort, useExisting: CreateBatchOperationJobUseCase },
        ValidateBatchOperationUseCase,
        { provide: ValidateBatchOperationPort, useExisting: ValidateBatchOperationUseCase },
        GetBatchOperationJobStatusUseCase,
        { provide: GetBatchOperationJobStatusPort, useExisting: GetBatchOperationJobStatusUseCase },
        ListBatchOperationJobsUseCase,
        { provide: ListBatchOperationJobsPort, useExisting: ListBatchOperationJobsUseCase },
        ListBatchOperationJobRowsUseCase,
        { provide: ListBatchOperationJobRowsPort, useExisting: ListBatchOperationJobRowsUseCase },
        CancelBatchOperationJobUseCase,
        { provide: CancelBatchOperationJobPort, useExisting: CancelBatchOperationJobUseCase },
        { provide: ConfigService, useValue: configStub },
        {
          provide: RequestContextPort,
          useValue: { get: () => ({ tenantId: 't1', userId: 'u1' }) },
        },
        {
          provide: NumberingPort,
          useValue: { nextNumber: () => Promise.resolve('BATCH-000001') },
        },
      ],
    }).compile();

    const registry = moduleRef.get(BatchOperationHandlerRegistry);
    registry.register('Invoice', ['approve'], {
      supportedOperations: () => ['approve'],
      validate: () => Promise.resolve({ canProceed: true }),
      execute: (entityId: string) => Promise.resolve({ resultSnapshot: { approved: entityId } }),
    });

    const controller = moduleRef.get(BatchOperationController);
    const resMock = { status: jest.fn() };
    const res = await controller.submit(
      {
        aggregateType: 'Invoice',
        operationCode: 'approve',
        entityIds: ['inv-1', 'inv-2'],
      },
      resMock as never,
    );

    expect(res.data.mode).toBe('SYNC');
    expect(res.data.status).toBe('COMPLETED');
    expect(res.data.successRecords).toBe(2);
    expect(resMock.status).not.toHaveBeenCalled();

    const fetched = await controller.get(res.data.id);
    expect(fetched.data.successRecords).toBe(2);

    const rows = await controller.getRows(res.data.id);
    expect(rows.data).toHaveLength(2);
    expect(rows.data.every(r => r.status === 'SUCCESS')).toBe(true);

    expect(controller.listHandlers().data).toEqual([
      { aggregateType: 'Invoice', supportedOperations: ['approve'] },
    ]);
  });
});
