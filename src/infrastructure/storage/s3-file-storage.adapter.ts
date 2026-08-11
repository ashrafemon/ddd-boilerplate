import { FileStorageService } from '@amirrivand/nestjs-file-storage';
import { Inject, Injectable } from '@nestjs/common';
import {
  FileDownloadResult,
  FileMetadata,
  FileStoragePort,
  FileUploadResult,
} from '@shared-kernel/ports/storage/file-storage.port';

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
    const url = disk.url ? await disk.url(key) : undefined;
    if (!url) {
      throw new Error('Presigned URLs are not supported by the configured storage disk');
    }
    return url;
  }
}
