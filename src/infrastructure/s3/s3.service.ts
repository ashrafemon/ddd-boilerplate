import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * S3 client module service — client initialization only.
 *
 * Builds the AWS S3 client (S3/MinIO compatible) from the typed config and
 * probes reachability at boot. All object operations (upload, download,
 * presigning, …) live in the platform layer's FileStoragePort adapter, which
 * uses `client` + `bucketName` directly.
 *
 * Explicit keys are used when present; otherwise the AWS default credential
 * chain (profile, IAM role, task role) resolves them. `S3_ENDPOINT` targets
 * S3-compatible stores such as MinIO; path-style addressing follows
 * `S3_FORCE_PATH_STYLE`.
 */
@Injectable()
export class S3Service implements OnModuleInit, OnModuleDestroy {
  private readonly clientInstance?: S3Client;
  private readonly isProduction: boolean;
  private readonly bucket: string;
  private readonly publicBaseUrlConfig?: string;
  private readonly defaultPresignTtlSeconds: number;
  private readonly logger = new Logger(S3Service.name);

  constructor(configService: ConfigService) {
    const config = configService.getS3();

    this.isProduction = configService.isProduction;
    this.bucket = config.bucket;
    this.publicBaseUrlConfig = config.url || undefined;
    this.defaultPresignTtlSeconds = config.presignedUrlTtlSeconds;

    this.clientInstance = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      ...(config.pathStyle ? { forcePathStyle: true } : {}),
      ...(config.accessKey && config.secretKey
        ? { credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } }
        : {}),
      // Bound every request — without this a black-holed network (firewall,
      // DNS hang) stalls boot indefinitely on the init probe.
      requestHandler: {
        connectTimeout: 3_000,
        requestTimeout: 5_000,
      },
    });
  }

  /** The configured S3 client. Throws rather than returning undefined. */
  get client(): S3Client {
    if (!this.clientInstance) {
      throw new InfrastructureException('S3 client is not initialized');
    }
    return this.clientInstance;
  }

  get bucketName(): string {
    return this.bucket;
  }

  /** Public/CDN base URL for object links, when configured. */
  get publicBaseUrl(): string | undefined {
    return this.publicBaseUrlConfig;
  }

  /** Default TTL for presigned URLs when the caller does not specify one. */
  get presignTtlSeconds(): number {
    return this.defaultPresignTtlSeconds;
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log('s3-connected');
    } catch (error) {
      // Any HTTP response (200/403/404) proves the endpoint is reachable —
      // only a network-level failure means the client cannot reach storage.
      const err = error as Error & { $metadata?: { httpStatusCode?: number } };
      if (err.$metadata?.httpStatusCode) {
        this.logger.log('s3-connected');
        return;
      }
      const reason = err.message;
      if (this.isProduction) {
        throw new InfrastructureException('s3-unreachable', { reason });
      }
      this.logger.warn(`s3-unreachable: ${reason}`);
    }
  }

  public onModuleDestroy(): void {
    this.clientInstance?.destroy();
  }
}
