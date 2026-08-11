import { z } from 'zod';
import { numberFromString } from '../env-helpers';

/**
 * Application-level configuration group (service metadata, HTTP binding,
 * multi-tenant header names).
 */
export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.string().default('development'),
  APP_NAME: z.string().default('erp-api'),
  PORT: numberFromString(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  TENANT_HEADER: z.string().default('x-tenant-id'),
  ORGANIZATION_HEADER: z.string().default('x-organization-id'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
