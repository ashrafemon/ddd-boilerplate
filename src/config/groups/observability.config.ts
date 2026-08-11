import { z } from 'zod';
import { booleanFromString } from '../env-helpers';

/**
 * Observability group — Sentry, Prometheus and Loki credentials.
 */
export const observabilityConfigSchema = z.object({
  SENTRY_ENABLED: booleanFromString(false),
  SENTRY_DSN: z.string().default(''),

  PROMETHEUS_ENABLED: booleanFromString(false),
  PROMETHEUS_METRICS_PATH: z.string().default('/metrics'),

  LOKI_ENABLED: booleanFromString(false),
  LOKI_URL: z.string().default(''),
});

export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;
