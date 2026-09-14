import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IThrottlerConfig = { ttlMs: number; limit: number };
export type TenancyMode = 'single' | 'multi';
export type ITenancyConfig = {
  /**
   * `single` (default): identity headers are trusted — for internal/dev
   * deployments or behind a verified gateway.
   * `multi`: every request must carry a JWT whose `tenantId` claim is
   * verified server-side; raw identity headers are ignored and anonymous
   * requests are rejected.
   */
  mode: TenancyMode;
};
export type ISecurityConfig = {
  throttler: IThrottlerConfig;
  settingsEncryptionKey: string;
  tenantHeader: string;
  organizationHeader: string;
  tenancy: ITenancyConfig;
};

/**
 * Security config — AES key for encrypted settings, global throttler
 * defaults, tenant/organization header names and the tenancy mode.
 */
export default registerAs('security', () => {
  const settingsEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY;
  const tenancyMode = process.env.TENANCY_MODE === 'multi' ? 'multi' : 'single';

  if (process.env.NODE_ENV === 'production' && !settingsEncryptionKey) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be set when NODE_ENV=production');
  }

  if (
    tenancyMode === 'multi' &&
    process.env.NODE_ENV !== 'test' &&
    !process.env.JWT_ACCESS_SECRET
  ) {
    throw new Error('JWT_ACCESS_SECRET must be set when TENANCY_MODE=multi');
  }

  return {
    throttler: {
      ttlMs: numericEnv('THROTTLE_TTL_MS', 60_000),
      limit: numericEnv('THROTTLE_LIMIT', 120),
    },
    settingsEncryptionKey: settingsEncryptionKey ?? 'dev-enc-key-change-me',
    tenantHeader: process.env.TENANT_HEADER ?? 'x-tenant-id',
    organizationHeader: process.env.ORGANIZATION_HEADER ?? 'x-organization-id',
    tenancy: { mode: tenancyMode },
  };
});
