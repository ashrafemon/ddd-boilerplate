import { Module } from '@nestjs/common';
import { S3Module as InfraS3Module } from '@infrastructure/s3/s3.module';
import { S3FileStorageAdapter } from './adapters/s3-file-storage.adapter';
import { FileStoragePort } from './ports/file-storage.port';

/**
 * Platform storage module — provides the FileStoragePort adapter backed by the
 * S3 client initialized in the infrastructure layer.
 */
@Module({
  imports: [InfraS3Module],
  providers: [S3FileStorageAdapter, { provide: FileStoragePort, useClass: S3FileStorageAdapter }],
  exports: [FileStoragePort],
})
export class StorageModule {}
