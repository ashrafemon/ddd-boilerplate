import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { ConfigService } from '@config/config.service';
import { Module } from '@nestjs/common';
import { buildStorageConfig } from './storage-config.factory';

/**
 * Infrastructure storage module — only client initialization/setup.
 *
 * Registers the file storage disk configuration. The platform layer
 * provides the FileStoragePort adapter.
 */

@Module({
  imports: [
    FileStorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildStorageConfig,
    }),
  ],
  exports: [FileStorageModule],
})
export class StorageModule {}
