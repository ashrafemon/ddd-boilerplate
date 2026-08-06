import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './auth.config';
import cacheConfig from './cache.config';
import databaseConfig from './database.config';
import messageConfig from './message.config';
import securityConfig from './security.config';
import storageConfig from './storage.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    NestConfigModule.forFeature(appConfig),
    NestConfigModule.forFeature(authConfig),
    NestConfigModule.forFeature(databaseConfig),
    NestConfigModule.forFeature(cacheConfig),
    NestConfigModule.forFeature(messageConfig),
    NestConfigModule.forFeature(storageConfig),
    NestConfigModule.forFeature(securityConfig),
  ],
})
export class ConfigModule {}
