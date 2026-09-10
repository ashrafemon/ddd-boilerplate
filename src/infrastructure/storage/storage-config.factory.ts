import type { LocalDiskConfig, S3DiskConfig, StorageConfig } from '@amirrivand/nestjs-file-storage';
import { ConfigService } from '@config/config.service';

/**
 * Builds the file storage disk configuration from the typed config facade.
 * Plain function so `FileStorageModule.forRootAsync` only injects the global
 * ConfigService instead of a provider declared in the storage module.
 *
 * Note: `S3_FORCE_PATH_STYLE` and `S3_PRESIGNED_URL_TTL_SECONDS` are parsed in
 * `config/storage.config.ts` but are deliberately not forwarded — the
 * `S3DiskConfig` of @amirrivand/nestjs-file-storage exposes neither option.
 */
export function buildStorageConfig(
  config: ConfigService,
): StorageConfig<{ local: LocalDiskConfig; s3: S3DiskConfig }> {
  const storageDriver = config.getStorageDriver();
  const s3Config = config.getS3();

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
        ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
        ...(s3Config.url ? { cdnBaseUrl: s3Config.url } : {}),
      },
    },
  };
}
