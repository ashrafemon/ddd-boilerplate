import type { LocalDiskConfig, S3DiskConfig, StorageConfig } from '@amirrivand/nestjs-file-storage';
import { ConfigService } from '@config/config.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageConfigFactory {
  constructor(private readonly config: ConfigService) {}

  public createStorageConfig(): StorageConfig<{ local: LocalDiskConfig; s3: S3DiskConfig }> {
    // const storage = this.config.get<{
    //   driver: string;
    //   s3: {
    //     accessKey: string;
    //     secretKey: string;
    //     bucket: string;
    //     endpoint?: string;
    //     region?: string;
    //     url?: string;
    //   };
    // }>('storage', {
    //   driver: 's3',
    //   s3: {
    //     accessKey: '',
    //     secretKey: '',
    //     bucket: '',
    //     endpoint: '',
    //     region: 'us-east-1',
    //     url: '',
    //   },
    // });

    const storageDriver = this.config.getStorageDriver();
    const s3Config = this.config.getS3();

    return {
      default: storageDriver,
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
