import { SetMetadata } from '@nestjs/common';

export const RBAC_KEY = 'rbac';

export function Rbac(resource: string, action: string) {
  return SetMetadata(RBAC_KEY, { resource, action });
}
