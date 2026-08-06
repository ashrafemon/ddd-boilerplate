import { registerAs } from '@nestjs/config';

/**
 * Redis config — used for caching, distributed locks and rate limiting.
 */
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
}));
