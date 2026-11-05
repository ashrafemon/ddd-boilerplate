import { Module } from '@nestjs/common';
import { StorageModule as InfraStorageModule } from '@infrastructure/storage/storage.module';
import { S3FileStorageAdapter } from './adapters/s3-file-storage.adapter';
import { FileStoragePort } from './ports/file-storage.port';

/**
 * Platform storage module — provides the FileStoragePort adapter backed by the
 * file storage client initialized in the infrastructure layer.
 */
@Module({
  imports: [InfraStorageModule],
  providers: [S3FileStorageAdapter, { provide: FileStoragePort, useClass: S3FileStorageAdapter }],
  exports: [FileStoragePort],
})
export class StorageModule {}
