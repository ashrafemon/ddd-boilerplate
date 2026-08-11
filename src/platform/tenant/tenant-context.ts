import { TenantId } from '../../shared-business/value-object/tenant-id';

/**
 * Value object describing the current tenant.
 */
export class TenantContext {
  public readonly tenantId: TenantId;
  public readonly code?: string;

  private constructor(tenantId: TenantId, code?: string) {
    this.tenantId = tenantId;
    this.code = code;
  }

  public static create(tenantId: TenantId, code?: string): TenantContext {
    return new TenantContext(tenantId, code);
  }
}
