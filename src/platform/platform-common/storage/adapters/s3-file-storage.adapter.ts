import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { S3Service } from '@infrastructure/s3/s3.service';
import {
  FileDownloadResult,
  FileMetadata,
  FileStoragePort,
  FileUploadResult,
  PresignedUpload,
} from '@platform/platform-common/storage/ports/file-storage.port';

/**
 * FileStoragePort adapter over the infrastructure AWS S3 client (S3/MinIO
 * compatible). Owns every object operation — the infrastructure layer only
 * initializes the client.
 */
@Injectable()
export class S3FileStorageAdapter implements FileStoragePort {
  constructor(private readonly s3: S3Service) {}

  public async upload(input: {
    key: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<FileUploadResult> {
    await this.s3.client.send(
      new PutObjectCommand({
        Bucket: this.s3.bucketName,
        Key: input.key,
        Body: input.body,
        ...(input.contentType ? { ContentType: input.contentType } : {}),
        ...(input.metadata ? { Metadata: input.metadata } : {}),
      }),
    );

    return {
      key: input.key,
      ...(this.s3.publicBaseUrl
        ? { url: `${this.s3.publicBaseUrl.replace(/\/$/, '')}/${input.key}` }
        : {}),
      size: input.body.length,
      ...(input.contentType ? { contentType: input.contentType } : {}),
    };
  }

  public async download(key: string): Promise<FileDownloadResult> {
    const response = await this.s3.client.send(
      new GetObjectCommand({ Bucket: this.s3.bucketName, Key: key }),
    );
    return { body: Buffer.from(await response.Body!.transformToByteArray()) };
  }

  public async delete(key: string): Promise<void> {
    await this.s3.client.send(new DeleteObjectCommand({ Bucket: this.s3.bucketName, Key: key }));
  }

  public async getMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const response = await this.s3.client.send(
        new HeadObjectCommand({ Bucket: this.s3.bucketName, Key: key }),
      );
      return {
        key,
        size: response.ContentLength ?? 0,
        ...(response.ContentType ? { contentType: response.ContentType } : {}),
      };
    } catch (error) {
      const err = error as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  public async getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return getSignedUrl(
      this.s3.client,
      new GetObjectCommand({ Bucket: this.s3.bucketName, Key: key }),
      { expiresIn: expiresInSeconds ?? this.s3.presignTtlSeconds },
    );
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
    const url = await getSignedUrl(
      this.s3.client,
      new PutObjectCommand({ Bucket: this.s3.bucketName, Key: input.key }),
      { expiresIn: input.expiresInSeconds },
    );
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
