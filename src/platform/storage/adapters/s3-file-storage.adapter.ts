import { FileStorageService } from '@amirrivand/nestjs-file-storage';
import { Inject, Injectable } from '@nestjs/common';
import {
  FileDownloadResult,
  FileMetadata,
  FileStoragePort,
  FileUploadResult,
  PresignedUpload,
} from '@platform/storage/ports/file-storage.port';

/**
 * File storage adapter backed by @amirrivand/nestjs-file-storage (S3 / local
 * disks). Delegates every FileStoragePort operation to the configured default
 * disk.
 */
@Injectable()
export class S3FileStorageAdapter implements FileStoragePort {
  constructor(@Inject(FileStorageService) private readonly storage: FileStorageService) {}

  public async upload(input: {
    key: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<FileUploadResult> {
    const disk = this.storage.disk();
    await disk.put(input.key, input.body, {
      ContentType: input.contentType,
      visibility: 'private',
    });

    const url = disk.url ? await disk.url(input.key) : undefined;
    return {
      key: input.key,
      url,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  public async download(key: string): Promise<FileDownloadResult> {
    const body = await this.storage.disk().get(key);
    return { body };
  }

  public async delete(key: string): Promise<void> {
    await this.storage.disk().delete(key);
  }

  public async getMetadata(key: string): Promise<FileMetadata | null> {
    const meta = await this.storage.disk().getMetadata?.(key);
    if (!meta) return null;
    return {
      key,
      size: meta.size,
      contentType: meta.mimeType ?? meta.ContentType,
    };
  }

  public async getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const disk = this.storage.disk();
    if (disk.getTemporaryUrl) {
      return disk.getTemporaryUrl(key, expiresInSeconds);
    }
    // NEVER fall back to disk.url(): on the S3 driver that is the indefinite
    // public/CDN URL for a private object — an unauthenticated read primitive.
    throw new Error('Presigned URLs are not supported by the configured storage disk');
  }

  /**
   * NOTE: the returned PUT URL is not a S3 POST policy — `maxBytes` and
   * `contentTypes` are NOT enforced by S3 on a plain PUT presign. They are
   * advisory for the client and enforced authoritatively when the job is
   * created (`CreateImportJobUseCase` getMetadata size check + the upload DTO
   * content-type allowlist).
   */
  public async createPresignedUpload(input: {
    key: string;
    expiresInSeconds: number;
    maxBytes?: number;
    contentTypes?: string[];
  }): Promise<PresignedUpload> {
    const url = await this.getPresignedUrl(input.key, input.expiresInSeconds);
    return {
      method: 'PUT',
      url,
      key: input.key,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      maxBytes: input.maxBytes,
      contentTypes: input.contentTypes,
    };
  }
}
