import { registerAs } from '@nestjs/config';

export type IDatabaseDriver = 'postgres' | 'mysql';
export type IDatabaseConfig = { url: string; readUrl?: string };

/**
 * PostgreSQL connection config (critical infrastructure — lives in .env).
 * `readUrl` is the read/replica connection used by PrismaReadService; it
 * falls back to the write URL when no replica is configured.
 */
export default registerAs('database', () => ({
  driver: process.env.DATABASE_DRIVER ?? 'postgres',
  postgres: {
    url: process.env.DATABASE_URL ?? '',
    readUrl: process.env.DATABASE_SLAVE_URL ?? process.env.DATABASE_URL ?? '',
  },
}));
