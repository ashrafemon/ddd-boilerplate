import { FileStorageModule } from '@amirrivand/nestjs-file-storage';
import { Global, Module } from '@nestjs/common';
import { StorageConfigFactory } from './storage-config.factory';

/**
 * Infrastructure storage module — only client initialization/setup.
 *
 * Registers the file storage disk configuration. The platform layer
 * provides the FileStoragePort adapter.
 */
@Global()
@Module({
  imports: [
    FileStorageModule.forRootAsync({
      inject: [StorageConfigFactory],
      useFactory: (factory: StorageConfigFactory) => factory.createStorageConfig(),
    }),
  ],
  providers: [StorageConfigFactory],
  exports: [StorageConfigFactory],
})
export class StorageModule {}
