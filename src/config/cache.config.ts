import { registerAs } from '@nestjs/config';

/**
 * Redis config — used for caching, distributed locks and rate limiting.
 */
export default registerAs('cache', () => ({
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
}));
