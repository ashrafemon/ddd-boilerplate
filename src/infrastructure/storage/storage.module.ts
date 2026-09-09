import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { Module } from '@nestjs/common';
import { StorageConfigFactory } from './storage-config.factory';
import { ConfigModule } from '@config/config.module';

/**
 * Infrastructure storage module — only client initialization/setup.
 *
 * Registers the file storage disk configuration. The platform layer
 * provides the FileStoragePort adapter.
 */

@Module({
  imports: [
    FileStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [StorageConfigFactory],
      useFactory: (factory: StorageConfigFactory) => factory.createStorageConfig(),
    }),
  ],
  providers: [StorageConfigFactory],
  exports: [StorageConfigFactory],
})
export class StorageModule {}
