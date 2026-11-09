import { NotFoundException } from '@nestjs/common';

export class TenantScope {
  static assertVisible(resourceTenantId: string | null, requestTenantId?: string): void {
    if (requestTenantId && resourceTenantId && resourceTenantId !== requestTenantId) {
      throw new NotFoundException();
    }
  }

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
