import { SetMetadata } from '@nestjs/common';

/**
 * Route metadata for RBAC authorization. Applied via `@UseGuards(RbacGuard)`.
 *
 * Example:
 *   @UseGuards(RbacGuard)
 *   @Rbac('PurchaseOrder', 'approve')
 *   @Patch(':id/approve')
 *   async approve(...) { ... }
 */
export const RBAC_KEY = 'rbac';

export function Rbac(resource: string, action: string) {
  return SetMetadata(RBAC_KEY, { resource, action });
}
