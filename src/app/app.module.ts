import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PlatformModule } from '../platform/platform.module';
import { AppConfigModule } from '../config/config.module';
import { RequestContextMiddleware } from '../platform/context/request-context.middleware';
import { PurchaseModule } from '../business/purchase/purchase.module';
import { ProductModule } from '../business/product/product.module';
import { VendorModule } from '../business/vendor/vendor.module';
import { GlobalExceptionFilter } from '../shared-kernel/http/filter/global-exception.filter';
import { AuthGuard } from '../shared-kernel/http/guard/auth.guard';
import { RolesGuard } from '../shared-kernel/http/guard/roles.guard';
import { LoggingInterceptor } from '../shared-kernel/http/interceptor/logging.interceptor';
import { ResponseInterceptor } from '../shared-kernel/http/interceptor/response.interceptor';
import { TIMEOUT_MS_TOKEN, TimeoutInterceptor } from '../shared-kernel/http/interceptor/timeout.interceptor';
import { SharedKernelModule } from '../shared-kernel/shared-kernel.module';

/**
 * Root application module.
 *
 * Order matters:
 *  1. AppConfigModule bootstraps the environment (validated from .env).
 *  2. SharedKernelModule provides shared contracts and utilities.
 *  3. InfrastructureModule provides client adapters (CLS/transactions,
 *     observability, event bus, database, cache, messaging, storage) for the
 *     platform ports.
 *  4. PlatformModule provides the platform services (context, tenant, outbox,
 *     idempotency, saga, workflow, health).
 *  5. Bounded contexts are imported as independent modules.
 */
@Module({
  imports: [
    AppConfigModule,
    SharedKernelModule,
    InfrastructureModule,
    PlatformModule,
    VendorModule,
    ProductModule,
    PurchaseModule,
  ],
  providers: [
    { provide: TIMEOUT_MS_TOKEN, useValue: 30_000 },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
