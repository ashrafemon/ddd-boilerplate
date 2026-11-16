import { NotFoundException } from '@nestjs/common';
import { TenantScope } from '@common/application/utils/tenant-scope';

describe('PurchaseOrder tenant isolation', () => {
  it('hides a resource owned by another tenant as 404', () => {
    expect(() => TenantScope.assertVisible('tenant-2', 'tenant-1')).toThrow(NotFoundException);
  });

  it('allows a resource owned by the same tenant', () => {
    expect(() => TenantScope.assertVisible('tenant-1', 'tenant-1')).not.toThrow();
  });

  it('builds a tenant-scoped where filter', () => {
    expect(TenantScope.where('tenant-1')).toEqual({ tenantId: 'tenant-1' });
  });

  it('can include unscoped rows when explicitly requested', () => {
    expect(TenantScope.where('tenant-1', { includeUnscoped: true })).toEqual({
      OR: [{ tenantId: 'tenant-1' }, { tenantId: null }],
    });
  });
});
