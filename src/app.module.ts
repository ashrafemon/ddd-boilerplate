import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { HttpExceptionsFilter } from './shared-kernal/filters/http-exception.filter';
import { ResponseInterceptor } from './shared-kernal/interceptors/response.interceptor';
import { AppValidationPipe } from './shared-kernal/pipes/validator.pipe';

@Module({
  imports: [ConfigModule, InfrastructureModule],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionsFilter },
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
  ],
})
export class AppModule {}
