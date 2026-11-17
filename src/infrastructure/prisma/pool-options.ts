import type { IDatabaseConfig } from '@config/database.config';
import type { PoolConfig } from 'pg';

/**
 * Maps the typed database config onto node-postgres pool options. Plain
 * function so both Prisma clients build identical, centrally-tuned pools.
 *
 * Sizing behind PgBouncer (transaction mode): keep `max` small — PgBouncer
 * multiplexes clients over its own server pool. Session startup parameters
 * (`statement_timeout`, `idle_in_transaction_session_timeout`,
 * `application_name`) do not propagate through transaction pooling; enforce
 * them server-side with `ALTER ROLE ... SET ...` when PgBouncer is in front.
 */
export function buildPgPoolOptions(config: IDatabaseConfig): PoolConfig {
  const pool = config.pool;

  return {
    connectionString: config.url,
    max: pool.max,
    min: pool.min,
    idleTimeoutMillis: pool.idleTimeoutMs,
    connectionTimeoutMillis: pool.connectionTimeoutMs,
    statement_timeout: pool.statementTimeoutMs,
    idle_in_transaction_session_timeout: pool.idleInTransactionTimeoutMs,
    application_name: pool.applicationName,
  };
}
