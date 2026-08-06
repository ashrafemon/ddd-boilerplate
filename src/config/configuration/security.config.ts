import { registerAs } from '@nestjs/config';

/**
 * Security config — AES key for encrypted settings and global throttler
 * defaults.
 */
export default registerAs('security', () => ({
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? 'deyalpost-dev-key!!',
  throttler: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
}));
