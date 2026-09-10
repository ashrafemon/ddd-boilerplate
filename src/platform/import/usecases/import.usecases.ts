import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
import { PageResult } from '@shared-kernel/types/pagination';
import { ImportHandlerRegistry } from '../import-handler.registry';
import {
  applyMapping,
  parseImportFile,
  structuralValidateRow,
  suggestMapping,
} from '../import-file.parser';
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
} from '../ports/import.ports';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import {
  ColumnMapping,
  ImportContext,
  ImportJobRecord,
  ImportJobRowRecord,
  ImportOptions,
  RowResult,
  RowVerdict,
} from '../import.types';
import {
  ImportAvScanNotCleanError,
  ImportBuildShaMismatchError,
  ImportFileTooLargeError,
  ImportJobNotFoundError,
  ImportMappingIncompleteError,
  ImportRowLimitExceededError,
  ImportSourceFileMissingError,
  InvalidImportJobStateError,
  StorageObjectNotFoundError,
} from '../import.errors';

@Injectable()
export class InitImportUseCase implements InitImportPort {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
  ) {}

  async execute(input: { entityKey: string; tenantId?: string }) {
    const descriptor = this.registry.resolveDescriptor(input.entityKey);
    const recent = await this.jobs.list({
      tenantId: input.tenantId,
      entityKey: input.entityKey,
      page: 1,
      pageSize: 5,
    });
    return {
      descriptor,
      limits: {
        maxRows: descriptor.maxRows,
        maxFileSizeBytes: descriptor.maxFileSizeBytes,
      },
      recentJobs: recent.items,
    };
  }
}

@Injectable()
export class CreateImportUploadUseCase implements CreateImportUploadPort {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
  ) {}

  async execute(input: {
    entityKey: string;
    tenantId?: string;
    contentType?: string;
    idempotencyKey?: string;
  }) {
    const descriptor = this.registry.resolveDescriptor(input.entityKey);
    const cfg = this.config.getImport();
    const maxBytes = Math.min(descriptor.maxFileSizeBytes, cfg.maxFileSizeBytes);
    const key = `imports/${input.tenantId ?? 'global'}/${input.entityKey}/${
      input.idempotencyKey ?? randomUUID()
    }`;
    const expiresAt = new Date(Date.now() + cfg.presignedUploadTtlSeconds * 1000);
    const obj = await this.storageObjects.createPending({
      tenantId: input.tenantId,
      storageKey: key,
      purpose: 'IMPORT_SOURCE',
      contentType: input.contentType,
      expiresAt,
      scanStatus: cfg.skipAvScan ? 'SKIPPED' : 'PENDING',
    });
    const upload = await this.storage.createPresignedUpload({
      key,
      expiresInSeconds: cfg.presignedUploadTtlSeconds,
      maxBytes,
      contentTypes: [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
    });
    return { storageObjectId: obj.id, upload };
  }
}

@Injectable()
export class CreateImportJobUseCase implements CreateImportJobPort {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    private readonly numbering: NumberingPort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
  ) {}

  async execute(input: {
    entityKey: string;
    storageObjectId: string;
    tenantId?: string;
    requestedBy?: string;
    traceId?: string;
    options?: ImportOptions;
  }): Promise<ImportJobRecord> {
    const descriptor = this.registry.resolveDescriptor(input.entityKey);
    const cfg = this.config.getImport();
    const obj = await this.storageObjects.findById(input.storageObjectId);
    if (!obj) {
      throw new StorageObjectNotFoundError(input.storageObjectId);
    }
    const meta = await this.storage.getMetadata(obj.storageKey);
    if (!meta) {
      throw new ImportSourceFileMissingError(input.storageObjectId);
    }
    const maxBytes = Math.min(descriptor.maxFileSizeBytes, cfg.maxFileSizeBytes);
    if (meta.size > maxBytes) {
      throw new ImportFileTooLargeError(input.entityKey, meta.size, maxBytes);
    }
    const scanStatus = cfg.skipAvScan
      ? 'CLEAN'
      : obj.scanStatus === 'SKIPPED'
        ? 'CLEAN'
        : obj.scanStatus;
    if (scanStatus !== 'CLEAN') {
      throw new ImportAvScanNotCleanError(obj.id, scanStatus);
    }
    await this.storageObjects.markVerified(obj.id, {
      sizeBytes: meta.size,
      contentType: meta.contentType ?? obj.contentType,
      scanStatus: 'CLEAN',
    });

    const jobNo = await this.numbering.nextNumber('import-job', { prefix: 'IMP-', padding: 6 });
    const job = await this.jobs.create({
      tenantId: input.tenantId,
      jobNo,
      entityKey: input.entityKey,
      descriptorVersion: descriptor.version,
      descriptorSnapshot: { ...descriptor },
      sourceStorageObjectId: obj.id,
      options: input.options,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      buildSha: cfg.buildSha,
    });
    await this.queue.enqueueParse(job.id);
    return job;
  }
}

@Injectable()
export class GetImportJobStatusUseCase implements GetImportJobStatusPort {
  constructor(@Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort) {}

  async execute(input: { jobId: string; tenantId?: string }): Promise<ImportJobRecord> {
    const job = await this.requireJob(input.jobId, input.tenantId);
    return job;
  }

  private async requireJob(jobId: string, tenantId?: string) {
    const job = await this.jobs.findById(jobId);
    if (!job || (tenantId && job.tenantId && job.tenantId !== tenantId)) {
      throw new ImportJobNotFoundError(jobId);
    }
    return job;
  }
}

@Injectable()
export class ListImportJobsUseCase implements ListImportJobsPort {
  constructor(@Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort) {}

  execute(input: {
    tenantId?: string;
    status?: ImportJobRecord['status'];
    entityKey?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ImportJobRecord>> {
    return this.jobs.list(input);
  }
}

@Injectable()
export class CancelImportJobUseCase implements CancelImportJobPort {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await this.jobs.findById(input.jobId);
    if (!job || (input.tenantId && job.tenantId && job.tenantId !== input.tenantId)) {
      throw new ImportJobNotFoundError(input.jobId);
    }
    const terminal = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'];
    if (terminal.includes(job.status)) {
      return job;
    }
    await this.jobs.setCancelRequested(job.id);
    if (['PENDING_UPLOAD', 'UPLOADED', 'MAPPED', 'VALIDATED'].includes(job.status)) {
      const cancelled = await this.jobs.markTerminal(job.id, 'CANCELLED', {
        from: job.status,
        to: 'CANCELLED',
        at: new Date(),
        actor: input.actor,
      });
      await this.outbox.writeCancelledEvent(cancelled);
      return cancelled;
    }
    return (await this.jobs.findById(job.id))!;
  }
}

@Injectable()
export class UpdateImportMappingUseCase implements UpdateImportMappingPort {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
  ) {}

  async execute(input: {
    jobId: string;
    mapping: ColumnMapping;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await this.jobs.findById(input.jobId);
    if (!job || (input.tenantId && job.tenantId && job.tenantId !== input.tenantId)) {
      throw new ImportJobNotFoundError(input.jobId);
    }
    if (job.status !== 'MAPPED' && job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      // allow mapping update when MAPPED (re-map before validate)
    }
    if (!['MAPPED'].includes(job.status)) {
      throw new InvalidImportJobStateError(job.id, job.status, 'MAPPED');
    }
    const required = job.descriptorSnapshot.fields.filter(f => f.required).map(f => f.targetField);
    const mappedTargets = new Set(Object.values(input.mapping));
    const missing = required.filter(f => !mappedTargets.has(f));
    if (missing.length > 0) {
      throw new ImportMappingIncompleteError(job.entityKey, missing);
    }
    let updated = await this.jobs.setColumnMapping(job.id, input.mapping);
    updated = await this.jobs.transitionStatus(job.id, 'MAPPED', 'VALIDATING', {
      from: 'MAPPED',
      to: 'VALIDATING',
      at: new Date(),
      actor: input.actor,
      detail: 'mapping confirmed',
    });
    await this.queue.enqueueValidate(job.id);
    return updated;
  }
}

@Injectable()
export class GetImportPreviewUseCase implements GetImportPreviewPort {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async execute(input: { jobId: string; tenantId?: string }) {
    const job = await this.jobs.findById(input.jobId);
    if (!job || (input.tenantId && job.tenantId && job.tenantId !== input.tenantId)) {
      throw new ImportJobNotFoundError(input.jobId);
    }
    const previewLimit = this.config.getImport().previewRows;
    const { rows } = await this.rows.listByJob(job.id, { page: 1, pageSize: previewLimit });
    const sourceColumns = rows[0]?.rawPayload ? Object.keys(rows[0].rawPayload) : [];
    const suggestedMapping =
      job.columnMapping ?? suggestMapping(sourceColumns, job.descriptorSnapshot);
    return {
      job,
      sheets: ['Sheet1'],
      headerRow: 1,
      sourceColumns,
      suggestedMapping,
      sampleRows: rows.map(r => r.rawPayload ?? {}),
    };
  }
}

@Injectable()
export class GetImportReportUseCase implements GetImportReportPort {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
  ) {}

  async execute(input: { jobId: string; tenantId?: string; page: number; pageSize: number }) {
    const job = await this.jobs.findById(input.jobId);
    if (!job || (input.tenantId && job.tenantId && job.tenantId !== input.tenantId)) {
      throw new ImportJobNotFoundError(input.jobId);
    }
    const { rows, total } = await this.rows.listByJob(job.id, {
      page: input.page,
      pageSize: input.pageSize,
      validationStatus: 'INVALID',
    });
    return {
      job,
      errorRows: {
        items: rows,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }
}

@Injectable()
export class ExecuteImportJobUseCase implements ExecuteImportJobPort {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await this.jobs.findById(input.jobId);
    if (!job || (input.tenantId && job.tenantId && job.tenantId !== input.tenantId)) {
      throw new ImportJobNotFoundError(input.jobId);
    }
    if (job.status !== 'VALIDATED') {
      throw new InvalidImportJobStateError(job.id, job.status, 'VALIDATED');
    }
    const updated = await this.jobs.transitionStatus(job.id, 'VALIDATED', 'EXECUTING', {
      from: 'VALIDATED',
      to: 'EXECUTING',
      at: new Date(),
      actor: input.actor,
    });
    await this.queue.enqueueExecute(job.id);
    return updated;
  }
}

@Injectable()
export class ParseImportJobUseCase implements ParseImportJobPort {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new ImportJobNotFoundError(jobId);
    this.assertBuildSha(job);

    if (job.status === 'MAPPED' || job.status === 'VALIDATING' || job.status === 'VALIDATED') {
      return;
    }
    if (job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      throw new InvalidImportJobStateError(job.id, job.status, ['UPLOADED', 'PARSING']);
    }

    await this.jobs.transitionStatus(job.id, ['UPLOADED', 'PARSING'], 'PARSING', {
      from: job.status,
      to: 'PARSING',
      at: new Date(),
    });

    try {
      const obj = job.sourceStorageObjectId
        ? await this.storageObjects.findById(job.sourceStorageObjectId)
        : null;
      if (!obj) throw new ImportSourceFileMissingError(job.id);
      const downloaded = await this.storage.download(obj.storageKey);
      const maxRows = Math.min(job.descriptorSnapshot.maxRows, this.config.getImport().maxRows);
      const parsed = parseImportFile(
        downloaded.body,
        obj.contentType ?? downloaded.contentType,
        obj.storageKey,
        maxRows + 1,
      );
      if (parsed.rows.length > maxRows) {
        throw new ImportRowLimitExceededError(job.entityKey, parsed.rows.length, maxRows);
      }

      await this.rows.deleteByJob(job.id);
      const mapping = suggestMapping(parsed.headers, job.descriptorSnapshot);
      const chunk: Parameters<ImportJobRowRepositoryPort['bulkInsert']>[0] = [];
      for (const row of parsed.rows) {
        chunk.push({
          tenantId: job.tenantId,
          importJobId: job.id,
          rowNumber: row.rowNumber,
          rawPayload: row.values,
          mappedPayload: applyMapping(row.values, mapping),
        });
        if (chunk.length >= 500) {
          await this.rows.bulkInsert(chunk);
          chunk.length = 0;
        }
      }
      if (chunk.length) await this.rows.bulkInsert(chunk);

      await this.jobs.setColumnMapping(job.id, mapping);
      await this.jobs.updateCounters(job.id, { totalRows: parsed.rows.length });
      await this.jobs.transitionStatus(job.id, 'PARSING', 'MAPPED', {
        from: 'PARSING',
        to: 'MAPPED',
        at: new Date(),
        detail: `parsed ${parsed.rows.length} rows`,
      });
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'PARSING',
        to: 'FAILED',
        at: new Date(),
        detail: err instanceof Error ? err.message : String(err),
      });
      await this.outbox.writeFailedEvent(failed);
      throw err;
    }
  }

  private assertBuildSha(job: ImportJobRecord) {
    const current = this.config.getImport().buildSha;
    if (job.buildSha && job.buildSha !== current) {
      throw new ImportBuildShaMismatchError(job.id, job.buildSha, current);
    }
  }
}

@Injectable()
export class ValidateImportJobUseCase implements ValidateImportJobPort {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new ImportJobNotFoundError(jobId);
    this.assertBuildSha(job);
    if (job.status === 'VALIDATED' || job.status === 'EXECUTING') return;
    if (job.status !== 'VALIDATING' && job.status !== 'MAPPED') {
      throw new InvalidImportJobStateError(job.id, job.status, ['MAPPED', 'VALIDATING']);
    }
    if (job.status === 'MAPPED') {
      await this.jobs.transitionStatus(job.id, 'MAPPED', 'VALIDATING', {
        from: 'MAPPED',
        to: 'VALIDATING',
        at: new Date(),
      });
    }

    const handler = this.registry.resolveHandler(job.entityKey);
    const cfg = this.config.getImport();
    const ctx: ImportContext = {
      tenantId: job.tenantId,
      userId: job.requestedBy,
      jobId: job.id,
      traceId: job.traceId,
      options: job.options ?? {},
    };

    try {
      for (;;) {
        if (await this.jobs.isCancelRequested(job.id)) {
          const cancelled = await this.jobs.markTerminal(job.id, 'CANCELLED', {
            from: 'VALIDATING',
            to: 'CANCELLED',
            at: new Date(),
          });
          await this.outbox.writeCancelledEvent(cancelled);
          return;
        }
        const pending = await this.rows.listPendingValidation(job.id, cfg.validationChunkSize);
        if (pending.length === 0) break;

        const structural: RowVerdict[] = [];
        const domainCandidates: ImportJobRowRecord[] = [];
        for (const row of pending) {
          const mapped = row.mappedPayload ?? {};
          const errors = structuralValidateRow(mapped, job.descriptorSnapshot);
          if (errors.length) {
            structural.push({ rowNumber: row.rowNumber, status: 'INVALID', errors });
          } else {
            domainCandidates.push(row);
          }
        }
        if (structural.length) {
          await this.rows.applyValidationVerdicts(job.id, structural);
        }
        if (domainCandidates.length) {
          const payloads = domainCandidates.map(r => ({
            rowNumber: r.rowNumber,
            ...(r.mappedPayload ?? {}),
          }));
          const refs = await handler.preloadReferences(payloads, ctx);
          const verdicts = await handler.validateBatch(payloads, refs, ctx);
          await this.rows.applyValidationVerdicts(job.id, verdicts);
        }
        const counts = await this.rows.countByValidationStatus(job.id);
        await this.jobs.updateCounters(job.id, {
          validRows: counts.VALID,
          invalidRows: counts.INVALID + counts.DUPLICATE,
        });
      }

      const counts = await this.rows.countByValidationStatus(job.id);
      await this.jobs.updateCounters(job.id, {
        validRows: counts.VALID,
        invalidRows: counts.INVALID + counts.DUPLICATE,
      });
      await this.jobs.transitionStatus(job.id, 'VALIDATING', 'VALIDATED', {
        from: 'VALIDATING',
        to: 'VALIDATED',
        at: new Date(),
      });
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'VALIDATING',
        to: 'FAILED',
        at: new Date(),
        detail: err instanceof Error ? err.message : String(err),
      });
      await this.outbox.writeFailedEvent(failed);
      throw err;
    }
  }

  private assertBuildSha(job: ImportJobRecord) {
    const current = this.config.getImport().buildSha;
    if (job.buildSha && job.buildSha !== current) {
      throw new ImportBuildShaMismatchError(job.id, job.buildSha, current);
    }
  }
}

@Injectable()
export class RunImportExecutionUseCase implements RunImportExecutionPort {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new ImportJobNotFoundError(jobId);
    this.assertBuildSha(job);
    if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return;
    }
    if (job.status !== 'EXECUTING') {
      throw new InvalidImportJobStateError(job.id, job.status, 'EXECUTING');
    }

    const handler = this.registry.resolveHandler(job.entityKey);
    const cfg = this.config.getImport();
    const chunkSize = job.descriptorSnapshot.executionChunkSize || cfg.executionChunkSize;
    const ctx: ImportContext = {
      tenantId: job.tenantId,
      userId: job.requestedBy,
      jobId: job.id,
      traceId: job.traceId,
      options: job.options ?? {},
    };

    try {
      for (;;) {
        if (await this.jobs.isCancelRequested(job.id)) {
          const cancelled = await this.jobs.markTerminal(job.id, 'CANCELLED', {
            from: 'EXECUTING',
            to: 'CANCELLED',
            at: new Date(),
          });
          await this.outbox.writeCancelledEvent(cancelled);
          return;
        }
        const pending = await this.rows.claimForExecution(job.id, chunkSize);
        if (pending.length === 0) break;

        // Re-validate inside execution chunk (staleness guard).
        const payloads = pending.map(r => ({
          rowNumber: r.rowNumber,
          ...(r.mappedPayload ?? {}),
        }));
        const refs = await handler.preloadReferences(payloads, ctx);
        const verdicts = await handler.validateBatch(payloads, refs, ctx);
        const stillValid = new Set(
          verdicts.filter(v => v.status === 'VALID').map(v => v.rowNumber),
        );
        const skipResults: RowResult[] = verdicts
          .filter(v => v.status !== 'VALID')
          .map(v => ({
            rowNumber: v.rowNumber,
            status: 'SKIPPED' as const,
            errorMessage: (v.errors ?? ['re-validation failed']).join('; '),
          }));
        if (skipResults.length) {
          await this.rows.applyExecutionResults(job.id, skipResults);
        }

        const toExecute = payloads.filter(p => stillValid.has(p.rowNumber));
        if (toExecute.length) {
          const results = await handler.executeBatch(toExecute, ctx);
          await this.rows.applyExecutionResults(job.id, results);
        }

        const execCounts = await this.rows.countByExecutionStatus(job.id);
        await this.jobs.updateCounters(job.id, {
          appliedRows: execCounts.APPLIED,
          failedRows: execCounts.FAILED + execCounts.SKIPPED,
        });
      }

      const execCounts = await this.rows.countByExecutionStatus(job.id);
      const status =
        execCounts.FAILED + execCounts.SKIPPED > 0 || job.invalidRows > 0
          ? 'COMPLETED_WITH_ERRORS'
          : 'COMPLETED';
      const completed = await this.jobs.markTerminal(job.id, status, {
        from: 'EXECUTING',
        to: status,
        at: new Date(),
      });
      await this.jobs.updateCounters(job.id, {
        appliedRows: execCounts.APPLIED,
        failedRows: execCounts.FAILED + execCounts.SKIPPED,
      });
      await this.outbox.writeCompletedEvent(completed);
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'EXECUTING',
        to: 'FAILED',
        at: new Date(),
        detail: err instanceof Error ? err.message : String(err),
      });
      await this.outbox.writeFailedEvent(failed);
      throw err;
    }
  }

  private assertBuildSha(job: ImportJobRecord) {
    const current = this.config.getImport().buildSha;
    if (job.buildSha && job.buildSha !== current) {
      throw new ImportBuildShaMismatchError(job.id, job.buildSha, current);
    }
  }
}
