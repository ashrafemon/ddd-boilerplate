import type { LocalDiskConfig, S3DiskConfig, StorageConfig } from '@amirrivand/nestjs-file-storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageConfigFactory {
  constructor(private readonly config: ConfigService) {}

  public createStorageConfig(): StorageConfig<{ local: LocalDiskConfig; s3: S3DiskConfig }> {
    const storage = this.config.get<{
      driver: string;
      s3: {
        accessKey: string;
        secretKey: string;
        bucket: string;
        endpoint?: string;
        region?: string;
        url?: string;
      };
    }>('storage', {
      driver: 's3',
      s3: {
        accessKey: '',
        secretKey: '',
        bucket: '',
        endpoint: '',
        region: 'us-east-1',
        url: '',
      },
    });

    return {
      default: storage.driver === 'local' ? 'local' : 's3',
      disks: {
        local: { driver: 'local', root: './uploads' },
        s3: {
          driver: 's3',
          accessKeyId: storage.s3.accessKey,
          secretAccessKey: storage.s3.secretKey,
          region: storage.s3.region ?? '',
          bucket: storage.s3.bucket,
          endpoint: storage.s3.endpoint,
          cdnBaseUrl: storage.s3.url,
        },
      },
    };
  }
}
