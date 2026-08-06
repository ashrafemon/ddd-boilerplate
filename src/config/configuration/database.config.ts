import { registerAs } from '@nestjs/config';

/**
 * PostgreSQL connection config (critical infrastructure — lives in .env).
 */
export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER ?? 'deyalpost',
  password: process.env.DATABASE_PASSWORD ?? 'deyalpost',
  name: process.env.DATABASE_NAME ?? 'deyalpost',
}));
