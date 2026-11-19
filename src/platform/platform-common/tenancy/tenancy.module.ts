import { Module } from '@nestjs/common';
import { TenancyAuthGuard } from './http/tenancy-auth.guard';

/**
 * Platform tenancy capability — the HTTP trust boundary for multi-tenant
 * deployments.
 *
 * Owns `TenancyAuthGuard`: in `TENANCY_MODE=multi` it verifies the bearer JWT,
 * requires a `tenantId` claim and stashes the verified identity for the request
 * context; in `single` mode it is a pass-through. It is registered globally as
 * an `APP_GUARD` in `AppModule` and exported here so the composition root can
 * bind it by token.
 *
 * The guard is an HTTP-only driver, so it lives in `http/` (platform standard
 * §2), not next to the CLS context ports it does not use.
 */
@Module({
  providers: [TenancyAuthGuard],
  exports: [TenancyAuthGuard],
})
export class TenancyModule {}
