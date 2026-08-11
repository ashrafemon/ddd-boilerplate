import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InfrastructureException } from '../../../shared-kernel/exceptions/infrastructure.exception';
import { ConfigurationService } from '../../../config/configuration.service';
import { LoggerPort } from '../../../shared-kernel/ports/observability/logger.port';
import {
  FileDownloadResult,
  FileMetadata,
  FileStoragePort,
  FileUploadResult,
} from '../../../shared-kernel/ports/storage/file-storage.port';

/**
 * S3-backed file storage adapter. Self-disables when S3 is not configured.
 */
@Injectable()
export class S3FileStorageAdapter implements FileStoragePort {
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly presignedUrlTtlSeconds: number;

  constructor(
    configuration: ConfigurationService,
    private readonly logger: LoggerPort,
  ) {
    const settings = configuration.getS3();
    this.presignedUrlTtlSeconds = settings.presignedUrlTtlSeconds;
    if (settings.enabled && settings.bucket) {
      const aws = configuration.getAws();
      this.s3 = new S3Client({
        region: settings.region ?? aws.region,
        credentials: aws.accessKeyId
          ? { accessKeyId: aws.accessKeyId, secretAccessKey: aws.secretAccessKey }
          : undefined,
      });
      this.bucket = settings.bucket;
    }
  }

  public async upload(input: {
    key: string;
    body: Buffer;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<FileUploadResult> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );
    return { key: input.key, size: input.body.length, contentType: input.contentType };
  }

  public async download(key: string): Promise<FileDownloadResult> {
    const client = this.requireClient();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = await response.Body?.transformToByteArray();
    return {
      body: Buffer.from(body ?? []),
      contentType: response.ContentType,
    };
  }

  public async delete(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  public async getMetadata(key: string): Promise<FileMetadata | null> {
    const client = this.requireClient();
    try {
      const response = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType,
      };
    } catch (error) {
      if (error instanceof NoSuchKey) {
        return null;
      }
      throw error;
    }
  }

  public async getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const client = this.requireClient();
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(client, command, {
      expiresIn: expiresInSeconds ?? this.presignedUrlTtlSeconds,
    });
  }

  private requireClient(): S3Client {
    if (!this.s3 || !this.bucket) {
      throw new InfrastructureException('S3 file storage is not configured', {
        hint: 'Set S3_ENABLED=true and S3_BUCKET',
      });
    }
    return this.s3;
  }
}
