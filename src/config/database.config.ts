import { registerAs } from '@nestjs/config';
import { numericEnv, requiredInProduction } from '@common/application/utils/env.util';

export type IDatabaseDriver = 'postgres' | 'mysql';
export type IDatabasePoolConfig = {
  /** Max app-side connections. Behind PgBouncer keep this SMALL — PgBouncer multiplexes many more clients over its own server pool. */
  max: number;
  /** Min idle connections kept alive (0 = create on demand). */
  min: number;
  /** Idle connections are closed after this many ms. */
  idleTimeoutMs: number;
  /** Fail fast instead of queueing forever when the pool is exhausted. */
  connectionTimeoutMs: number;
  /** Server-side per-statement timeout (direct connections; see PgBouncer note below). */
  statementTimeoutMs: number;
  /** Kills sessions left idle inside an open transaction — protects against leaked transactions. */
  idleInTransactionTimeoutMs: number;
  /** Shows up in pg_stat_activity so DBAs can attribute connections to this app. */
  applicationName: string;
};
export type IDatabaseConfig = { url: string; readUrl?: string; pool: IDatabasePoolConfig };

/**
 * PostgreSQL connection config (critical infrastructure — lives in .env).
 * `readUrl` is the read/replica connection used by PrismaReadService; it
 * falls back to the write URL when no replica is configured.
 *
 * PgBouncer (transaction pooling) guidance:
 * - Keep `DATABASE_POOL_MAX` small (10–20 per instance). PgBouncer multiplexes
 *   client connections over a much smaller server pool; a large app-side pool
 *   only adds queueing.
 * - Transaction mode does NOT forward session startup parameters, so
 *   `statement_timeout` / `idle_in_transaction_session_timeout` set here are
 *   effective for direct connections only. Behind PgBouncer, enforce them
 *   server-side: `ALTER ROLE app SET statement_timeout = '30s'` (or per
 *   database) — that is the authoritative place.
 * - node-postgres does not cache named prepared statements, so it is safe for
 *   transaction pooling as-is.
 */
export default registerAs('database', () => {
  requiredInProduction('DATABASE_URL');

  return {
    driver: process.env.DATABASE_DRIVER ?? 'postgres',
    postgres: {
      url: process.env.DATABASE_URL ?? '',
      readUrl:
        process.env.DATABASE_SLAVE_URL ??
        process.env.DATABASE_READ_URL ??
        process.env.DATABASE_URL ??
        '',
      pool: {
        max: numericEnv('DATABASE_POOL_MAX', 10),
        min: numericEnv('DATABASE_POOL_MIN', 0),
        idleTimeoutMs: numericEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', 10_000),
        connectionTimeoutMs: numericEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 10_000),
        statementTimeoutMs: numericEnv('DATABASE_STATEMENT_TIMEOUT_MS', 30_000),
        idleInTransactionTimeoutMs: numericEnv('DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', 60_000),
        applicationName: process.env.DATABASE_APPLICATION_NAME ?? 'erp-boilerplate',
      },
    },
  };
});
