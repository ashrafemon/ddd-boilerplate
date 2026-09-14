import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ContextModule } from '@platform/context/context.module';
import { NumberingModule } from '@platform/numbering/numbering.module';
import { OutboxModule } from '@platform/outbox/outbox.module';
import { StorageModule } from '@platform/storage/storage.module';
import { ImportReconciliationConsumer } from './import-reconciliation.consumer';
import { ImportHandlerRegistry } from './import-handler.registry';
import {
  CancelImportJobPort,
  CreateImportJobPort,
  CreateImportUploadPort,
  ExecuteImportJobPort,
  GetImportJobStatusPort,
  GetImportPreviewPort,
  GetImportReportPort,
  InitImportPort,
  ListImportJobsPort,
  ParseImportJobPort,
  RunImportExecutionPort,
  UpdateImportMappingPort,
  ValidateImportJobPort,
} from './ports/import.ports';
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
import {
  CancelImportJobAdapter,
  CreateImportJobAdapter,
  CreateImportUploadAdapter,
  ExecuteImportJobAdapter,
  GetImportJobStatusAdapter,
  GetImportPreviewAdapter,
  GetImportReportAdapter,
  InitImportAdapter,
  ListImportJobsAdapter,
  ParseImportJobAdapter,
  RunImportExecutionAdapter,
  UpdateImportMappingAdapter,
  ValidateImportJobAdapter,
} from './adapters/import-inbound.adapters';

/**
 * Platform import — upload → parse → mapping → validation → execution, with
 * S3-backed storage objects, BullMQ fan-out and per-entityKey handlers
 * registered on ImportHandlerRegistry by the owning module at bootstrap.
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
    InitImportAdapter,
    { provide: InitImportPort, useExisting: InitImportAdapter },
    CreateImportUploadUseCase,
    CreateImportUploadAdapter,
    { provide: CreateImportUploadPort, useExisting: CreateImportUploadAdapter },
    CreateImportJobUseCase,
    CreateImportJobAdapter,
    { provide: CreateImportJobPort, useExisting: CreateImportJobAdapter },
    GetImportPreviewUseCase,
    GetImportPreviewAdapter,
    { provide: GetImportPreviewPort, useExisting: GetImportPreviewAdapter },
    UpdateImportMappingUseCase,
    UpdateImportMappingAdapter,
    { provide: UpdateImportMappingPort, useExisting: UpdateImportMappingAdapter },
    GetImportReportUseCase,
    GetImportReportAdapter,
    { provide: GetImportReportPort, useExisting: GetImportReportAdapter },
    ExecuteImportJobUseCase,
    ExecuteImportJobAdapter,
    { provide: ExecuteImportJobPort, useExisting: ExecuteImportJobAdapter },
    CancelImportJobUseCase,
    CancelImportJobAdapter,
    { provide: CancelImportJobPort, useExisting: CancelImportJobAdapter },
    GetImportJobStatusUseCase,
    GetImportJobStatusAdapter,
    { provide: GetImportJobStatusPort, useExisting: GetImportJobStatusAdapter },
    ListImportJobsUseCase,
    ListImportJobsAdapter,
    { provide: ListImportJobsPort, useExisting: ListImportJobsAdapter },
    ParseImportJobUseCase,
    ParseImportJobAdapter,
    { provide: ParseImportJobPort, useExisting: ParseImportJobAdapter },
    ValidateImportJobUseCase,
    ValidateImportJobAdapter,
    { provide: ValidateImportJobPort, useExisting: ValidateImportJobAdapter },
    RunImportExecutionUseCase,
    RunImportExecutionAdapter,
    { provide: RunImportExecutionPort, useExisting: RunImportExecutionAdapter },
  ],
  exports: [
    ImportHandlerRegistry,
    InitImportPort,
    CreateImportUploadPort,
    CreateImportJobPort,
    GetImportPreviewPort,
    UpdateImportMappingPort,
    GetImportReportPort,
    ExecuteImportJobPort,
    CancelImportJobPort,
    GetImportJobStatusPort,
    ListImportJobsPort,
  ],
})
export class ImportModule {}
