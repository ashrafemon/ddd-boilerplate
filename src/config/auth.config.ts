import { registerAs } from '@nestjs/config';
import { requiredInProduction } from './env.util';

/**
 * Auth config — JWT access/refresh secrets and TTLs. Secrets are mandatory
 * in production; the dev fallbacks exist so local development works out of
 * the box but must never reach a deployed environment.
 */
export default registerAs('auth', () => {
  requiredInProduction('JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET');

  return {
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
  };
});
