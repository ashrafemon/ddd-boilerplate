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

  /**
   * Prisma `where` fragment for a tenant-scoped read.
   *
   * - No request tenant (single-tenant deployment) → `{}`: see everything.
   * - `includeUnscoped` (shared master data: products, vendors) → the request's
   *   own rows PLUS rows that were never tenant-scoped (NULL). A NULL tenant
   *   means "shared", so a tenant sees the shared catalogue and its own rows.
   * - Otherwise (owned documents: purchase orders, GRNs, invoices) → only the
   *   request's own rows. An unscoped legacy row is invisible to a
   *   tenant-scoped request: fail-closed, because leaking a document across
   *   tenants is worse than hiding it from one.
   */
  static where<T extends object = object>(
    requestTenantId?: string,
    options?: { includeUnscoped?: boolean },
  ): T {
    if (!requestTenantId) {
      return {} as T;
    }
    if (options?.includeUnscoped) {
      return { OR: [{ tenantId: requestTenantId }, { tenantId: null }] } as T;
    }
    return { tenantId: requestTenantId } as T;
  }
}
