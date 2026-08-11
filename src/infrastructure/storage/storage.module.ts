import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { ConfigService } from '@config/config.service';
import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3/s3.service';

/**
 * File storage infrastructure (S3).
 */
@Global()
@Module({
  imports: [
    FileStorageModule.forRootAsync({
      imports: [],
      inject: [S3Service],
      useFactory: (service: S3Service) => {
        return service.createS3Options();
      },
    }),
  ],
  providers: [S3Service],
  exports: [],
})
export class StorageModule {}
