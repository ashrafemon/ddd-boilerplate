import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { NumberingModule } from '@platform/numbering/numbering.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { StorageModule } from '@platform/storage/storage.module';
import { ImportReconciliationConsumer } from './import-reconciliation.consumer';
import { ImportHandlerRegistry } from './import-handler.registry';
import { ImportJobOutboxWriterPort } from './ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from './ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from './ports/import-job-row-repository.port';
import { ImportQueuePublisherPort } from './ports/import-queue-publisher.port';
import { StorageObjectRepositoryPort } from './ports/storage-object-repository.port';
import {
  CancelImportJobUseCase,
  CreateImportJobUseCase,
  CreateImportUploadUseCase,
  ExecuteImportJobUseCase,
  GetImportJobStatusUseCase,
  GetImportPreviewUseCase,
  GetImportReportUseCase,
  InitImportUseCase,
  ListImportJobsUseCase,
  ParseImportJobUseCase,
  RunImportExecutionUseCase,
  UpdateImportMappingUseCase,
  ValidateImportJobUseCase,
} from './usecases/import.usecases';
import { PrismaImportJobOutboxWriter } from './repositories/prisma-import-job-outbox.writer';
import { PrismaImportJobRepository } from './repositories/prisma-import-job.repository';
import { PrismaImportJobRowRepository } from './repositories/prisma-import-job-row.repository';
import { PrismaStorageObjectRepository } from './repositories/prisma-storage-object.repository';
import { IMPORT_QUEUE_NAME } from './import.constants';
import { BullMqImportQueueAdapter } from './adapters/bullmq-import-queue.adapter';
import { BullMqImportWorker } from './adapters/bullmq-import.worker';
import { ImportController } from './http/import.controller';
import { ImportFileParser } from './import-file.parser';

/**
 * Platform import — upload -> parse -> mapping -> validation -> execution.
 *
 * Tables owned: storage_objects, import_jobs, import_job_rows.
 *
 * Lifecycle:
 *  1. CreateImportUploadUseCase — presigned S3 slot + StorageObject row.
 *  2. CreateImportJobUseCase    — [TX] import job snapshotting the registered
 *     ImportHandler descriptor; BullMQ parse stage.
 *  3. Parse    — ImportFileParser (xlsx/CSV) -> suggested ColumnMapping -> preview.
 *  4. Mapping  — user confirms/overrides; validation chunks run generic
 *     structural checks + handler.validateBatch (per-row verdicts, never aborts).
 *  5. Execute  — handler.executeBatch per chunk: claim -> ONE domain txn per row
 *     -> APPLIED/FAILED/SKIPPED; counters + progress; cancel flag honored.
 *  6. Terminal events go to the outbox; an error report becomes a StorageObject;
 *     the reconciliation cron fails stale-heartbeat jobs.
 *
 * Controller/worker inject use cases directly (no inbound ports);
 * ImportHandlerRegistry is the plugin boundary; jobs are tenant-scoped.
 */
@Module({
  imports: [
    ContextModule,
    NumberingModule,
    OutboxModule,
    StorageModule,
    BullModule.registerQueue({ name: IMPORT_QUEUE_NAME }),
  ],
  controllers: [ImportController],
  providers: [
    ImportHandlerRegistry,
    ImportFileParser,
    PrismaStorageObjectRepository,
    { provide: StorageObjectRepositoryPort, useExisting: PrismaStorageObjectRepository },
    PrismaImportJobRepository,
    { provide: ImportJobRepositoryPort, useExisting: PrismaImportJobRepository },
    PrismaImportJobRowRepository,
    { provide: ImportJobRowRepositoryPort, useExisting: PrismaImportJobRowRepository },
    PrismaImportJobOutboxWriter,
    { provide: ImportJobOutboxWriterPort, useExisting: PrismaImportJobOutboxWriter },
    BullMqImportQueueAdapter,
    { provide: ImportQueuePublisherPort, useExisting: BullMqImportQueueAdapter },
    BullMqImportWorker,
    ImportReconciliationConsumer,
    InitImportUseCase,
    CreateImportUploadUseCase,
    CreateImportJobUseCase,
    GetImportPreviewUseCase,
    UpdateImportMappingUseCase,
    ValidateImportJobUseCase,
    ParseImportJobUseCase,
    ExecuteImportJobUseCase,
    CancelImportJobUseCase,
    GetImportJobStatusUseCase,
    ListImportJobsUseCase,
    GetImportReportUseCase,
    RunImportExecutionUseCase,
  ],
  exports: [ImportHandlerRegistry],
})
export class ImportModule {}
