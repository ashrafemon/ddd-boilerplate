import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { AuditModule } from '@platform/audit/audit.module';
import { NumberingModule } from '@platform/numbering/numbering.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { BatchOperationHandlerRegistry } from './batch-operation-handler.registry';
import { BatchOperationWorker } from './batch-operation.worker';
import { BatchOperationReconciliationConsumer } from './batch-operation-reconciliation.consumer';
import { BatchOperationJobOutboxWriterPort } from './ports/batch-operation-job-outbox-writer.port';
import { BatchOperationJobRepositoryPort } from './ports/batch-operation-job-repository.port';
import { BatchOperationJobRowRepositoryPort } from './ports/batch-operation-job-row-repository.port';
import { BatchOperationQueuePublisherPort } from './ports/batch-operation-queue-publisher.port';
import { CancelBatchOperationJobUseCase } from './usecases/cancel-batch-operation-job.usecase';
import { CreateBatchOperationJobUseCase } from './usecases/create-batch-operation-job.usecase';
import { GetBatchOperationJobStatusUseCase } from './usecases/get-batch-operation-job-status.usecase';
import { ListBatchOperationJobRowsUseCase } from './usecases/list-batch-operation-job-rows.usecase';
import { ListBatchOperationJobsUseCase } from './usecases/list-batch-operation-jobs.usecase';
import { ProcessBatchOperationRowUseCase } from './usecases/process-batch-operation-row.usecase';
import { ValidateBatchOperationUseCase } from './usecases/validate-batch-operation.usecase';
import { PrismaBatchOperationJobOutboxWriter } from './repositories/prisma-batch-operation-job-outbox.writer';
import { PrismaBatchOperationJobRepository } from './repositories/prisma-batch-operation-job.repository';
import { BATCH_OPERATION_QUEUE_NAME } from './batch-operation.constants';
import { BullMqBatchOperationQueueAdapter } from './adapters/bullmq-batch-operation-queue.adapter';
import { BullMqBatchOperationWorker } from './adapters/bullmq-batch-operation.worker';
import { BatchOperationController } from './http/batch-operation.controller';

/**
 * Platform batch-operation — Sync/Async bulk transitions for opted-in aggregates.
 *
 * Tables owned: batch_operation_jobs, batch_operation_job_rows.
 *
 * Lifecycle:
 *  1. ValidateBatchOperationUseCase — dry-run preview via the registered
 *     BatchOperationHandler (same validate() the real run uses).
 *  2. CreateBatchOperationJobUseCase — assert handler+operation, dedupe/cap ids,
 *     decide SYNC (<= syncThreshold) or ASYNC, write header + one PENDING row
 *     per entity in ONE transaction.
 *  3. SYNC runs BatchOperationWorker.processChunk in-process (full result in the
 *     HTTP response); ASYNC fans out fixed chunks through BullMQ (202 accepted).
 *  4. Per row: claim (UPDATE ... WHERE status='PENDING') -> handler.validate ->
 *     handler.execute -> row outcome + header counters. Handlers delegate to the
 *     aggregate's own single-record use cases — batch moves are indistinguishable
 *     from manual ones.
 *  5. Terminal counters -> finaliseJob -> outbox BatchOperationJobCompleted.
 *     Reconciliation cron resets stuck rows and re-dispatches orphans.
 *
 * No inbound ports: the controller/worker inject these use cases directly;
 * BatchOperationHandlerRegistry is the plugin boundary — PURE business
 * handlers are plugged into it by the composition-root bridge
 * (`src/bootstrap/configure-batch-operations.ts`; this file imports no
 * `@business/**`). Reads are tenant-scoped.
 */
@Module({
  imports: [
    ContextModule,
    AuditModule,
    NumberingModule,
    OutboxModule,
    BullModule.registerQueue({ name: BATCH_OPERATION_QUEUE_NAME }),
  ],
  controllers: [BatchOperationController],
  providers: [
    BatchOperationHandlerRegistry,
    PrismaBatchOperationJobRepository,
    { provide: BatchOperationJobRepositoryPort, useExisting: PrismaBatchOperationJobRepository },
    { provide: BatchOperationJobRowRepositoryPort, useExisting: PrismaBatchOperationJobRepository },
    PrismaBatchOperationJobOutboxWriter,
    {
      provide: BatchOperationJobOutboxWriterPort,
      useExisting: PrismaBatchOperationJobOutboxWriter,
    },
    BullMqBatchOperationQueueAdapter,
    {
      provide: BatchOperationQueuePublisherPort,
      useExisting: BullMqBatchOperationQueueAdapter,
    },
    BullMqBatchOperationWorker,
    BatchOperationWorker,
    BatchOperationReconciliationConsumer,
    CreateBatchOperationJobUseCase,
    ValidateBatchOperationUseCase,
    ProcessBatchOperationRowUseCase,
    GetBatchOperationJobStatusUseCase,
    ListBatchOperationJobsUseCase,
    ListBatchOperationJobRowsUseCase,
    CancelBatchOperationJobUseCase,
  ],
  exports: [
    BatchOperationHandlerRegistry,
    CreateBatchOperationJobUseCase,
    ValidateBatchOperationUseCase,
    ProcessBatchOperationRowUseCase,
    GetBatchOperationJobStatusUseCase,
    ListBatchOperationJobsUseCase,
    ListBatchOperationJobRowsUseCase,
    CancelBatchOperationJobUseCase,
  ],
})
export class BatchOperationModule {}
