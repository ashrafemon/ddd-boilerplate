import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { ConfigService } from '@config/config.service';
import { NumberingPort } from '@platform/numbering/ports/numbering.port';
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { ImportJobRepositoryPort } from '../ports/import-job-repository.port';
import { ImportQueuePublisherPort } from '../ports/import-queue-publisher.port';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';
import { ImportJobRecord, ImportOptions } from '../import.types';

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
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: {
    entityKey: string;
    storageObjectId: string;
    tenantId?: string;
    requestedBy?: string;
    traceId?: string;
    options?: ImportOptions;
  }): Promise<ImportJobRecord> {
    input = {
      ...input,
      tenantId: input.tenantId ?? this.requestContext.getTenantId(),
      requestedBy: input.requestedBy ?? this.requestContext.getUserId(),
      traceId: input.traceId ?? this.requestContext.getCorrelationId(),
    };
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
