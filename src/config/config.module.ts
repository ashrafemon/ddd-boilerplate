import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './configuration/app.config';
import authConfig from './configuration/auth.config';
import databaseConfig from './configuration/database.config';
import rabbitmqConfig from './configuration/rabbitmq.config';
import redisConfig from './configuration/redis.config';
import securityConfig from './configuration/security.config';
import storageConfig from './configuration/storage.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    NestConfigModule.forFeature(appConfig),
    NestConfigModule.forFeature(databaseConfig),
    NestConfigModule.forFeature(redisConfig),
    NestConfigModule.forFeature(rabbitmqConfig),
    NestConfigModule.forFeature(authConfig),
    NestConfigModule.forFeature(storageConfig),
    NestConfigModule.forFeature(securityConfig),
  ],
})
export class ConfigModule {}
