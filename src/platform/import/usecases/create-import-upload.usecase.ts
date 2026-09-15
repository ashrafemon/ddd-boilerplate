import { Inject, Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
import { ImportHandlerRegistry } from '../import-handler.registry';
import { StorageObjectRepositoryPort } from '../ports/storage-object-repository.port';

@Injectable()
export class CreateImportUploadUseCase {
  constructor(
    private readonly registry: ImportHandlerRegistry,
    private readonly config: ConfigService,
    private readonly storage: FileStoragePort,
    @Inject(StorageObjectRepositoryPort)
    private readonly storageObjects: StorageObjectRepositoryPort,
    @Inject(RequestContextPort) private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: {
    entityKey: string;
    tenantId?: string;
    contentType?: string;
    idempotencyKey?: string;
  }) {
    input = { ...input, tenantId: input.tenantId ?? this.requestContext.getTenantId() };
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
