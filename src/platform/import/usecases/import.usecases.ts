import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { PageResult } from '@shared-kernel/types/pagination';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { ImportFileParser } from '../import-file.parser';
import { ImportJobOutboxWriterPort } from '../ports/import-job-outbox-writer.port';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportJobRowRepositoryPort } from '../ports/import-job-row-repository.port';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import {
  ColumnMapping,
  ImportContext,
  ImportJobRecord,
  ImportJobRowRecord,
  ImportOptions,
  RowExecutionSettlement,
  RowResult,
  RowVerdict,
} from '../import.types';

/** Shared by the parse/validate/execute stages — a job built by an older deploy must not resume mid-pipeline under a changed build. */
class ImportBuildGuard {
  static assert(job: ImportJobRecord, currentBuildSha: string): void {
    if (job.buildSha && job.buildSha !== currentBuildSha) {
      throw new ConflictException(
        `ImportJob '${job.id}' was parsed by build ${job.buildSha} but this instance runs ${currentBuildSha}`,
      );
    }
  }

  /**
   * Behaviour-affecting descriptor changes (fields, required-ness, chunking)
   * must bump descriptor.version; a job may only continue on the shape it was
   * created with, otherwise validation would run on the snapshot while
   * execution uses a different live contract.
   */
  static assertDescriptorCurrent(
    job: ImportJobRecord,
    currentVersion: number,
    entityKey: string,
  ): void {
    if (job.descriptorVersion !== currentVersion) {
      throw new ConflictException(
        `Import handler '${entityKey}' is at descriptor v${currentVersion} but ` +
          `ImportJob '${job.id}' was created against v${job.descriptorVersion}; create a new job`,
      );
    }
  }
}

@Injectable()
export class InitImportUseCase {
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
export class CreateImportUploadUseCase {
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
export class CreateImportJobUseCase {
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
    if (
      !obj ||
      obj.purpose !== 'IMPORT_SOURCE' ||
      // Cross-tenant object references are indistinguishable from missing ones.
      (input.tenantId && obj.tenantId && obj.tenantId !== input.tenantId)
    ) {
      throw new NotFoundException(`StorageObject '${input.storageObjectId}' not found`);
    }
    const meta = await this.storage.getMetadata(obj.storageKey);
    if (!meta) {
      throw new NotFoundException(`Import source file is missing for '${input.storageObjectId}'`);
    }
    const maxBytes = Math.min(descriptor.maxFileSizeBytes, cfg.maxFileSizeBytes);
    if (meta.size > maxBytes) {
      throw new BadRequestException(
        `Import file for '${input.entityKey}' is ${meta.size} bytes, above the ${maxBytes}-byte limit`,
      );
    }
    const scanStatus = cfg.skipAvScan
      ? 'CLEAN'
      : obj.scanStatus === 'SKIPPED'
        ? 'CLEAN'
        : obj.scanStatus;
    if (scanStatus !== 'CLEAN') {
      throw new BadRequestException(
        `Storage object '${obj.id}' did not pass AV scanning (status: ${scanStatus})`,
      );
    }
    await this.storageObjects.markVerified(obj.id, {
      sizeBytes: meta.size,
      contentType: meta.contentType ?? obj.contentType,
      scanStatus: 'CLEAN',
    });
    // The upload-slot TTL must not expire the source while the job references
    // it: the consumed object lives for the configured retention window.
    await this.storageObjects.markConsumed(
      obj.id,
      new Date(Date.now() + cfg.sourceRetentionDays * 24 * 60 * 60 * 1000),
    );

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
export class GetImportJobStatusUseCase {
  constructor(@Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort) {}

  async execute(input: { jobId: string; tenantId?: string }): Promise<ImportJobRecord> {
    const job = await this.requireJob(input.jobId, input.tenantId);
    return job;
  }

  private async requireJob(jobId: string, tenantId?: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`ImportJob '${jobId}' not found`);
    }
    TenantScope.assertVisible(job.tenantId ?? null, tenantId);
    return job;
  }
}

@Injectable()
export class ListImportJobsUseCase {
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
export class CancelImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(AuditPort) private readonly audit: AuditPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
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
      if (cancelled) {
        await this.outbox.writeCancelledEvent(cancelled);
        await this.audit.record({
          action: 'import.cancelled',
          entityType: 'ImportJob',
          entityId: job.id,
          changes: { status: 'CANCELLED', entityKey: job.entityKey },
        });
        return cancelled;
      }
    }
    return (await this.jobs.findById(job.id))!;
  }
}

@Injectable()
export class UpdateImportMappingUseCase {
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
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    if (job.status !== 'MAPPED' && job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      // allow mapping update when MAPPED (re-map before validate)
    }
    if (!['MAPPED'].includes(job.status)) {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: MAPPED`,
      );
    }
    const required = job.descriptorSnapshot.fields.filter(f => f.required).map(f => f.targetField);
    const mappedTargets = new Set(Object.values(input.mapping));
    const missing = required.filter(f => !mappedTargets.has(f));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Mapping for '${job.entityKey}' is incomplete; missing required fields: ${missing.join(', ')}`,
      );
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
export class GetImportPreviewUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    private readonly config: ConfigService,
    private readonly parser: ImportFileParser,
  ) {}

  async execute(input: { jobId: string; tenantId?: string }) {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    const previewLimit = this.config.getImport().previewRows;
    const { rows } = await this.rows.listByJob(job.id, { page: 1, pageSize: previewLimit });
    const sourceColumns = rows[0]?.rawPayload ? Object.keys(rows[0].rawPayload) : [];
    const suggestedMapping =
      job.columnMapping ?? this.parser.suggestMapping(sourceColumns, job.descriptorSnapshot);
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
export class GetImportReportUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
  ) {}

  async execute(input: { jobId: string; tenantId?: string; page: number; pageSize: number }) {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
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
export class ExecuteImportJobUseCase {
  constructor(
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportQueuePublisherPort) private readonly queue: ImportQueuePublisherPort,
    @Inject(AuditPort) private readonly audit: AuditPort,
  ) {}

  async execute(input: {
    jobId: string;
    tenantId?: string;
    actor?: string;
  }): Promise<ImportJobRecord> {
    const job = await requireVisibleJob(this.jobs, input.jobId, input.tenantId);
    if (job.status !== 'VALIDATED') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: VALIDATED`,
      );
    }
    const updated = await this.jobs.transitionStatus(job.id, 'VALIDATED', 'EXECUTING', {
      from: 'VALIDATED',
      to: 'EXECUTING',
      at: new Date(),
      actor: input.actor,
    });
    await this.queue.enqueueExecute(job.id);
    await this.audit.record({
      action: 'import.execute-requested',
      entityType: 'ImportJob',
      entityId: job.id,
      changes: { status: 'EXECUTING', entityKey: job.entityKey },
    });
    return updated;
  }
}
/** Renewing stage lock: acquire once, heartbeat while the phase runs, release at the end. */
class StageLock {
  static async acquire(
    jobs: ImportJobRepositoryPort,
    jobId: string,
    stage: string,
    ttlMs: number,
    renewMs: number,
  ): Promise<(() => Promise<void>) | null> {
    const owner = `${stage}:${randomUUID()}`;
    if (!(await jobs.tryAcquireLock(jobId, owner, new Date(Date.now() + ttlMs)))) {
      return null;
    }
    const timer = setInterval(() => {
      void jobs.heartbeat(jobId, owner, new Date(Date.now() + ttlMs)).catch(() => undefined);
    }, renewMs);
    return async () => {
      clearInterval(timer);
      await jobs.releaseLock(jobId, owner).catch(() => undefined);
    };
  }
}

@Injectable()
export class ParseImportJobUseCase {
  private readonly logger = new Logger(ParseImportJobUseCase.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
    private readonly parser: ImportFileParser,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.runParse(jobId),
    );
  }

  private async runParse(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'parse',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Parse skipped for import job ${jobId}: locked by a live worker`);
      return;
    }

    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`ImportJob '${jobId}' not found`);
    ImportBuildGuard.assert(job, cfg.buildSha);

    if (job.status === 'MAPPED' || job.status === 'VALIDATING' || job.status === 'VALIDATED') {
      return;
    }
    if (job.status !== 'UPLOADED' && job.status !== 'PARSING') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: ${['UPLOADED', 'PARSING'].join(', ')}`,
      );
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
      if (!obj) throw new NotFoundException(`Import source file is missing for '${job.id}'`);
      const downloaded = await this.storage.download(obj.storageKey);
      const maxRows = Math.min(job.descriptorSnapshot.maxRows, cfg.maxRows);
      const parsed = this.parser.parseFile(
        downloaded.body,
        obj.contentType ?? downloaded.contentType,
        obj.storageKey,
        maxRows + 1,
      );
      if (parsed.rows.length > maxRows) {
        throw new BadRequestException(
          `Import file for '${job.entityKey}' has ${parsed.rows.length} rows, above the ${maxRows}-row limit`,
        );
      }

      await this.rows.deleteByJob(job.id);
      const mapping = this.parser.suggestMapping(parsed.headers, job.descriptorSnapshot);
      const chunk: Parameters<ImportJobRowRepositoryPort['bulkInsert']>[0] = [];
      for (const row of parsed.rows) {
        chunk.push({
          tenantId: job.tenantId,
          importJobId: job.id,
          rowNumber: row.rowNumber,
          rawPayload: row.values,
          mappedPayload: this.parser.applyMapping(row.values, mapping),
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
        detail: FailureMessage.of(err),
      });
      if (failed) {
        await this.outbox.writeFailedEvent(failed);
      }
      throw err;
    } finally {
      await release();
    }
  }
}

@Injectable()
export class ValidateImportJobUseCase {
  private readonly logger = new Logger(ValidateImportJobUseCase.name);

  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
    private readonly parser: ImportFileParser,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.runValidate(jobId),
    );
  }

  private async runValidate(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'validate',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Validate skipped for import job ${jobId}: locked by a live worker`);
      return;
    }

    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`ImportJob '${jobId}' not found`);
    ImportBuildGuard.assert(job, cfg.buildSha);
    const handler = this.registry.resolveHandler(job.entityKey);
    ImportBuildGuard.assertDescriptorCurrent(
      job,
      this.registry.resolveDescriptor(job.entityKey).version,
      job.entityKey,
    );
    if (job.status === 'VALIDATED' || job.status === 'EXECUTING') return;
    if (job.status !== 'VALIDATING' && job.status !== 'MAPPED') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: ${['MAPPED', 'VALIDATING'].join(', ')}`,
      );
    }
    if (job.status === 'MAPPED') {
      await this.jobs.transitionStatus(job.id, 'MAPPED', 'VALIDATING', {
        from: 'MAPPED',
        to: 'VALIDATING',
        at: new Date(),
      });
    }

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
          if (cancelled) {
            await this.outbox.writeCancelledEvent(cancelled);
          }
          return;
        }
        const pending = await this.rows.listPendingValidation(job.id, cfg.validationChunkSize);
        if (pending.length === 0) break;

        const structural: RowVerdict[] = [];
        const domainCandidates: ImportJobRowRecord[] = [];
        for (const row of pending) {
          const mapped = row.mappedPayload ?? {};
          const errors = this.parser.structuralValidateRow(mapped, job.descriptorSnapshot);
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
          // Termination contract: every candidate must leave PENDING, so a
          // handler that omits a verdict gets an explicit INVALID instead of
          // pinning the loop (and the worker slot) forever.
          const returned = new Set(verdicts.map(v => v.rowNumber));
          const missing: RowVerdict[] = domainCandidates
            .filter(r => !returned.has(r.rowNumber))
            .map(r => ({
              rowNumber: r.rowNumber,
              status: 'INVALID' as const,
              errors: ['handler returned no validation verdict'],
            }));
          await this.rows.applyValidationVerdicts(job.id, [...verdicts, ...missing]);
        }
        await this.jobs.recountCounters(job.id);
      }

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
        detail: FailureMessage.of(err),
      });
      if (failed) {
        await this.outbox.writeFailedEvent(failed);
      }
      throw err;
    } finally {
      await release();
    }
  }
}

@Injectable()
export class RunImportExecutionUseCase {
  private readonly logger = new Logger(RunImportExecutionUseCase.name);

  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    @Inject(ImportJobRepositoryPort) private readonly jobs: ImportJobRepositoryPort,
    @Inject(ImportJobRowRepositoryPort) private readonly rows: ImportJobRowRepositoryPort,
    @Inject(ImportJobOutboxWriterPort) private readonly outbox: ImportJobOutboxWriterPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.requestContext.run({ tenantId: job.tenantId, correlationId: job.traceId }, () =>
      this.runExecute(jobId),
    );
  }

  private async runExecute(jobId: string): Promise<void> {
    const cfg = this.config.getImport();
    const release = await StageLock.acquire(
      this.jobs,
      jobId,
      'execute',
      cfg.reconciliationWindowMs,
      cfg.lockRenewalMs,
    );
    if (!release) {
      this.logger.debug(`Execute skipped for import job ${jobId}: locked by a live worker`);
      return;
    }

    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`ImportJob '${jobId}' not found`);
    ImportBuildGuard.assert(job, cfg.buildSha);
    const handler = this.registry.resolveHandler(job.entityKey);
    ImportBuildGuard.assertDescriptorCurrent(
      job,
      this.registry.resolveDescriptor(job.entityKey).version,
      job.entityKey,
    );
    if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(job.status)) {
      return;
    }
    if (job.status !== 'EXECUTING') {
      throw new ConflictException(
        `ImportJob '${job.id}' is ${job.status}; expected one of: EXECUTING`,
      );
    }

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
          if (cancelled) {
            await this.outbox.writeCancelledEvent(cancelled);
          }
          return;
        }
        const claimed = await this.rows.claimForExecution(job.id, chunkSize);
        if (claimed.length === 0) break;

        const tokens = new Map(
          claimed.map(r => [r.rowNumber, r.executionClaimToken ?? -1] as const),
        );
        const settle = (rowNumber: number, result: RowResult): RowExecutionSettlement => ({
          ...result,
          executionClaimToken: tokens.get(rowNumber) ?? -1,
        });

        // Re-validate inside execution chunk (staleness guard).
        const payloads = claimed.map(r => ({
          rowNumber: r.rowNumber,
          ...(r.mappedPayload ?? {}),
        }));
        const refs = await handler.preloadReferences(payloads, ctx);
        const verdicts = await handler.validateBatch(payloads, refs, ctx);
        const stillValid = new Set(
          verdicts.filter(v => v.status === 'VALID').map(v => v.rowNumber),
        );
        const skipResults: RowExecutionSettlement[] = verdicts
          .filter(v => v.status !== 'VALID')
          .map(v =>
            settle(v.rowNumber, {
              rowNumber: v.rowNumber,
              status: 'SKIPPED' as const,
              errorMessage: (v.errors ?? ['re-validation failed']).join('; '),
            }),
          );
        if (skipResults.length) {
          await this.rows.applyExecutionResults(job.id, skipResults);
        }

        const toExecute = payloads.filter(p => stillValid.has(p.rowNumber));
        if (toExecute.length) {
          const executingRows = claimed
            .filter(r => stillValid.has(r.rowNumber))
            .map(r => r.rowNumber);
          try {
            const results = await handler.executeBatch(toExecute, ctx);
            await this.rows.applyExecutionResults(
              job.id,
              results.map(r => settle(r.rowNumber, r)),
            );
            // Results missing from the handler response (crash-free contract
            // breach) must not leave PROCESSING rows pinning the loop.
            const answered = new Set(results.map(r => r.rowNumber));
            const unanswered: RowExecutionSettlement[] = executingRows
              .filter(rowNumber => !answered.has(rowNumber))
              .map(rowNumber =>
                settle(rowNumber, {
                  rowNumber,
                  status: 'FAILED' as const,
                  errorMessage: 'handler returned no execution result',
                }),
              );
            if (unanswered.length) {
              await this.rows.applyExecutionResults(job.id, unanswered);
            }
          } catch (err) {
            // Chunk-level failure: the domain commits inside the handler are
            // opaque from here, so mark the whole claimed chunk FAILED for
            // operator review and keep the pipeline moving instead of
            // terminalising the job on one bad batch.
            const message = FailureMessage.of(err);
            this.logger.error(
              `Import execution chunk failed for job ${job.id}: ${message} — ${toExecute.length} rows marked FAILED`,
            );
            await this.rows.applyExecutionResults(
              job.id,
              executingRows.map(rowNumber =>
                settle(rowNumber, {
                  rowNumber,
                  status: 'FAILED' as const,
                  errorMessage: message,
                }),
              ),
            );
          }
        }
        await this.jobs.recountCounters(job.id);
      }

      const fresh = await this.jobs.recountCounters(job.id);
      const hasErrors = fresh !== null && (fresh.failedRows > 0 || fresh.invalidRows > 0);
      const status = hasErrors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      const completed = await this.jobs.markTerminal(job.id, status, {
        from: 'EXECUTING',
        to: status,
        at: new Date(),
      });
      if (completed) {
        await this.outbox.writeCompletedEvent(completed);
      }
    } catch (err) {
      const failed = await this.jobs.markTerminal(job.id, 'FAILED', {
        from: 'EXECUTING',
        to: 'FAILED',
        at: new Date(),
        detail: FailureMessage.of(err),
      });
      if (failed) {
        await this.outbox.writeFailedEvent(failed);
      }
      throw err;
    } finally {
      await release();
    }
  }
}

async function requireVisibleJob(
  jobs: ImportJobRepositoryPort,
  jobId: string,
  tenantId?: string,
): Promise<ImportJobRecord> {
  const job = await jobs.findById(jobId);
  if (!job) {
    throw new NotFoundException(`ImportJob '${jobId}' not found`);
  }
  TenantScope.assertVisible(job.tenantId ?? null, tenantId);
  return job;
}
