import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@config/config.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';

@Injectable()
export class S3Service {
  constructor(private readonly configService: ConfigService) {}

  createS3Options() {
    const defaultStorage = this.configService.getStorageDriver();
    const s3Config = this.configService.getS3();

    return {
      default: defaultStorage ?? 's3',
      disks: {
        local: { driver: 'local', root: './uploads' },
        s3: {
          driver: 's3',
          accessKeyId: s3Config.accessKey,
          secretAccessKey: s3Config.secretKey,
          region: s3Config.region ?? '',
          bucket: s3Config.bucket,
          endpoint: s3Config.endpoint,
          cdnBaseUrl: s3Config.url,
        },
      },
    };
  }
}
