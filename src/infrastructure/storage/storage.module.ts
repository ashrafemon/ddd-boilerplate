import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { Global, Module } from '@nestjs/common';
import { FileStoragePort } from '@shared-kernel/ports/storage/file-storage.port';
import { S3FileStorageAdapter } from './s3-file-storage.adapter';
import { StorageConfigFactory } from './storage-config.factory';

/**
 * File storage infrastructure (S3). Registers the disk configuration through
 * a dedicated factory service and exposes the platform `FileStoragePort`
 * through the S3 adapter.
 */
@Global()
@Module({
  imports: [
    FileStorageModule.forRootAsync({
      inject: [StorageConfigFactory],
      useFactory: (factory: StorageConfigFactory) => factory.createStorageConfig(),
    }),
  ],
  providers: [
    StorageConfigFactory,
    S3FileStorageAdapter,
    { provide: FileStoragePort, useClass: S3FileStorageAdapter },
  ],
  exports: [FileStoragePort, StorageConfigFactory],
})
export class StorageModule {}
