import { NotFoundException } from '@nestjs/common';
import { TenantScope } from './tenant-scope.util';

describe('TenantScope', () => {
  it('allows same-tenant and platform-owned (null) resources', () => {
    expect(() => TenantScope.assertVisible('t1', 't1')).not.toThrow();
    expect(() => TenantScope.assertVisible(null, 't1')).not.toThrow();
    expect(() => TenantScope.assertVisible('t1', undefined)).not.toThrow();
  });

  it('hides foreign-tenant resources as 404 (no existence leak)', () => {
    expect(() => TenantScope.assertVisible('t2', 't1')).toThrow(NotFoundException);
  });
});
