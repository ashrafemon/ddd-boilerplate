import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ProductModule } from '@business/catalog/product/product.module';
import { VendorModule } from '@business/supplier/vendor/vendor.module';
import { PurchaseOrderModule } from '@business/procurement/purchase/purchase-order.module';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PlatformModule } from './platform/platform.module';
import { HttpExceptionsFilter } from './shared-kernel/filters/http-exception.filter';
import { LoggingInterceptor } from './shared-kernel/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './shared-kernel/interceptors/request-id.interceptor';
import { ResponseInterceptor } from './shared-kernel/interceptors/response.interceptor';
import { AppValidationPipe } from './shared-kernel/pipes/validator.pipe';

@Module({
  imports: [
    ConfigModule,
    InfrastructureModule,
    PlatformModule,
    ProductModule,
    VendorModule,
    PurchaseOrderModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionsFilter },
    { provide: APP_PIPE, useClass: AppValidationPipe },
  ],
})
export class AppModule {}
