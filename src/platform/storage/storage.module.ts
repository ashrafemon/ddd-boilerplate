import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { Global, Module } from '@nestjs/common';
import { StorageConfigFactory } from '@infrastructure/storage/storage-config.factory';
import { S3FileStorageAdapter } from './adapters/s3-file-storage.adapter';
import { FileStoragePort } from './ports/file-storage.port';

/**
 * Platform storage module — provides the FileStoragePort adapter
 * backed by the S3 client initialized in the infrastructure layer.
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
