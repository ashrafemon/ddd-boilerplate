import { registerAs } from '@nestjs/config';
import { numericEnv } from './env.util';

export type IThrottlerConfig = { ttlMs: number; limit: number };
export type ISecurityConfig = {
  throttler: IThrottlerConfig;
  settingsEncryptionKey: string;
  tenantHeader: string;
  organizationHeader: string;
};

/**
 * Security config — AES key for encrypted settings, global throttler
 * defaults and the tenant/organization request header names.
 */
export default registerAs('security', () => {
  const settingsEncryptionKey = process.env.SETTINGS_ENCRYPTION_KEY;

  if (process.env.NODE_ENV === 'production' && !settingsEncryptionKey) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be set when NODE_ENV=production');
  }

  return {
    throttler: {
      ttlMs: numericEnv('THROTTLE_TTL_MS', 60_000),
      limit: numericEnv('THROTTLE_LIMIT', 120),
    },
    settingsEncryptionKey: settingsEncryptionKey ?? 'dev-enc-key-change-me',
    tenantHeader: process.env.TENANT_HEADER ?? 'x-tenant-id',
    organizationHeader: process.env.ORGANIZATION_HEADER ?? 'x-organization-id',
  };
});
