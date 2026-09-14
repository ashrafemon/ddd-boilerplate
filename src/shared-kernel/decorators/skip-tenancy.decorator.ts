import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANCY_KEY = 'skipTenancy';

/**
 * Marks a route as exempt from the TenancyAuthGuard (e.g. Prometheus scrape
 * endpoints). Never use this for business or tenant-scoped platform routes.
 */
export const SkipTenancy = () => SetMetadata(SKIP_TENANCY_KEY, true);
