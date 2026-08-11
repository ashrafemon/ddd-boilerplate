import { Global, Module } from '@nestjs/common';
import { FileStoragePort } from '../../shared-kernel/ports/storage/file-storage.port';
import { S3FileStorageAdapter } from './s3/s3-file-storage.adapter';

/**
 * File storage infrastructure (S3).
 */
@Global()
@Module({
  providers: [{ provide: FileStoragePort, useClass: S3FileStorageAdapter }],
  exports: [FileStoragePort],
})
export class StorageModule {}
