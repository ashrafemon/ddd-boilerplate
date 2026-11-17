import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';

/**
 * S3 client module — client initialization only.
 *
 * Registers the AWS S3 client (S3/MinIO compatible) from the typed config
 * facade. The platform layer provides the FileStoragePort adapter on top of
 * this client. Deliberately NOT `@Global()`.
 */
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
