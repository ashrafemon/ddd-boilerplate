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
import { PrismaImportJobOutboxWriter } from './adapters/prisma-import-job-outbox.writer';
import { PrismaImportJobRepository } from './adapters/prisma-import-job.repository';
import { PrismaImportJobRowRepository } from './adapters/prisma-import-job-row.repository';
import { PrismaStorageObjectRepository } from './adapters/prisma-storage-object.repository';
import { IMPORT_QUEUE_NAME } from './import.constants';
import { BullMqImportQueuePublisher } from './adapters/bullmq-import-queue.publisher';
import { BullMqImportWorker } from './adapters/bullmq-import.worker';
import { ImportController } from './http/import.controller';

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
    BullMqImportQueuePublisher,
    { provide: ImportQueuePublisherPort, useExisting: BullMqImportQueuePublisher },
    BullMqImportWorker,
    ImportReconciliationConsumer,
    InitImportUseCase,
    { provide: InitImportPort, useExisting: InitImportUseCase },
    CreateImportUploadUseCase,
    { provide: CreateImportUploadPort, useExisting: CreateImportUploadUseCase },
    CreateImportJobUseCase,
    { provide: CreateImportJobPort, useExisting: CreateImportJobUseCase },
    GetImportPreviewUseCase,
    { provide: GetImportPreviewPort, useExisting: GetImportPreviewUseCase },
    UpdateImportMappingUseCase,
    { provide: UpdateImportMappingPort, useExisting: UpdateImportMappingUseCase },
    GetImportReportUseCase,
    { provide: GetImportReportPort, useExisting: GetImportReportUseCase },
    ExecuteImportJobUseCase,
    { provide: ExecuteImportJobPort, useExisting: ExecuteImportJobUseCase },
    CancelImportJobUseCase,
    { provide: CancelImportJobPort, useExisting: CancelImportJobUseCase },
    GetImportJobStatusUseCase,
    { provide: GetImportJobStatusPort, useExisting: GetImportJobStatusUseCase },
    ListImportJobsUseCase,
    { provide: ListImportJobsPort, useExisting: ListImportJobsUseCase },
    ParseImportJobUseCase,
    { provide: ParseImportJobPort, useExisting: ParseImportJobUseCase },
    ValidateImportJobUseCase,
    { provide: ValidateImportJobPort, useExisting: ValidateImportJobUseCase },
    RunImportExecutionUseCase,
    { provide: RunImportExecutionPort, useExisting: RunImportExecutionUseCase },
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
