import { BusinessModule } from '@business/business.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from './config/config.service';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PlatformModule } from './platform/platform.module';
import { HttpExceptionsFilter } from '@common/http/filters/http-exception.filter';
import { DeviceResponseInterceptor } from '@common/http/interceptors/device-response.interceptor';
import { LoggingInterceptor } from '@common/http/interceptors/logging.interceptor';
import { RequestIdInterceptor } from '@common/http/interceptors/request-id.interceptor';
import { ResponseInterceptor } from '@common/http/interceptors/response.interceptor';
import { HttpThrottlerGuard } from '@common/http/guards/http-throttler.guard';
import { RbacGuard } from '@common/http/guards/rbac.guard';
import { AppValidationPipe } from '@common/http/pipes/validator.pipe';
import { TenancyAuthGuard } from '@platform/platform-common/context/guards/tenancy-auth.guard';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { ttlMs, limit } = config.getThrottler();
        return { throttlers: [{ ttl: ttlMs, limit }] };
      },
    }),
    InfrastructureModule,
    PlatformModule,
    BusinessModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: TenancyAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_FILTER, useClass: HttpExceptionsFilter },
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DeviceResponseInterceptor },
  ],
})
export class AppModule {}
