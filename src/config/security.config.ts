import { registerAs } from '@nestjs/config';

export type IThrottlerConfig = { ttlMs: number; limit: number };
/**
 * Security config — AES key for encrypted settings, global throttler
 * defaults and the tenant/organization request header names.
 */
export default registerAs('security', () => ({
  throttler: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? 'dev-enc-key-change-me',
  tenantHeader: process.env.TENANT_HEADER ?? 'x-tenant-id',
  organizationHeader: process.env.ORGANIZATION_HEADER ?? 'x-organization-id',
}));
