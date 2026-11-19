import { BusinessModule } from '@business/business.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigService } from './config/config.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { RedisModule as InfraRedisModule } from '@infrastructure/redis/redis.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PlatformModule } from './platform/platform.module';
import { HttpExceptionsFilter } from '@common/http/filters/http-exception.filter';
import { LoggerModule } from 'nestjs-pino';
import { DeviceResponseInterceptor } from '@common/http/interceptors/device-response.interceptor';
import { HttpCacheInterceptor } from '@common/http/interceptors/http-cache.interceptor';
import { LoggingInterceptor } from '@common/http/interceptors/logging.interceptor';
import { RequestIdInterceptor } from '@common/http/interceptors/request-id.interceptor';
import { ResponseInterceptor } from '@common/http/interceptors/response.interceptor';
import { HttpThrottlerGuard } from '@common/http/guards/http-throttler.guard';
import { RbacGuard } from '@common/http/guards/rbac.guard';
import { AppValidationPipe } from '@common/http/pipes/validator.pipe';
import { TenancyAuthGuard } from '@platform/platform-common/tenancy/http/tenancy-auth.guard';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug'),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: {
            // Probes and scrapes would drown the request log.
            ignore: req =>
              req.url?.includes('/health') === true || req.url?.includes('/metrics') === true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      // RedisService lives in RedisModule, which is not global — the dynamic
      // throttler module must import it explicitly to resolve the factory.
      imports: [InfraRedisModule],
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) => {
        const { ttlMs, limit } = config.getThrottler();
        return {
          throttlers: [{ ttl: ttlMs, limit }],
          // Redis-backed counters when Redis is configured; in-memory fallback
          // otherwise (single instance dev).
          ...(redis.isEnabled ? { storage: new ThrottlerStorageRedisService(redis.client) } : {}),
        };
      },
    }),
    // All packages/clients modules
    InfrastructureModule,
    // Communicator modules
    PlatformModule,
    // Business aggregate modules
    BusinessModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    // Bound by token: TenancyModule (exported by PlatformModule) owns the guard.
    { provide: APP_GUARD, useExisting: TenancyAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_FILTER, useClass: HttpExceptionsFilter },
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DeviceResponseInterceptor },
    // HTTP request/response cache (cache-manager), opt-in per route.
    // Data caching is the platform CachePort, never this.
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
  ],
})
export class AppModule {}
