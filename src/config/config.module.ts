import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './auth.config';
import cacheConfig from './cache.config';
import { ConfigService } from './config.service';
import databaseConfig from './database.config';
import messagingConfig from './messaging.config';
import notificationConfig from './notification.config';
import observabilityConfig from './observability.config';
import outboxConfig from './outbox.config';
import securityConfig from './security.config';
import storageConfig from './storage.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env',
      ],
    }),
    NestConfigModule.forFeature(appConfig),
    NestConfigModule.forFeature(authConfig),
    NestConfigModule.forFeature(databaseConfig),
    NestConfigModule.forFeature(cacheConfig),
    NestConfigModule.forFeature(messagingConfig),
    NestConfigModule.forFeature(storageConfig),
    NestConfigModule.forFeature(securityConfig),
    NestConfigModule.forFeature(outboxConfig),
    NestConfigModule.forFeature(notificationConfig),
    NestConfigModule.forFeature(observabilityConfig),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
