import { registerAs } from '@nestjs/config';

export type ILokiConfig = { url: string };
export type ISentryConfig = { dsn: string; tracesSampleRate: number };
export type ITracingConfig = { enabled: boolean; serviceName: string; endpoint: string };
export type IAwsConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * Observability config — logging level, Loki push endpoint, Sentry error
 * tracking, OpenTelemetry tracing and shared AWS credentials used by
 * S3/SNS/SES adapters.
 */
export default registerAs('observability', () => ({
  loki: {
    url: process.env.LOKI_URL ?? '',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  },
  tracing: {
    enabled: process.env.OTEL_TRACING_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'erp-boilerplate',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '',
  },
  aws: {
    region: process.env.AWS_REGION ?? 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
}));
