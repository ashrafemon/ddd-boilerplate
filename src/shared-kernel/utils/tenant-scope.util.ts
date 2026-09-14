import { NotFoundException } from '@nestjs/common';

/**
 * Multi-tenant visibility rule shared by every platform read/mutation path:
 * a resource owned by another tenant is NOT FOUND (never 403 — no existence
 * leak). Rows without a tenant are platform-owned and visible to all;
 * requests without a tenant header (single-tenant deployments) see everything.
 */
export class TenantScope {
  static assertVisible(resourceTenantId: string | null, requestTenantId?: string): void {
    if (requestTenantId && resourceTenantId && resourceTenantId !== requestTenantId) {
      throw new NotFoundException();
    }
  }
}
