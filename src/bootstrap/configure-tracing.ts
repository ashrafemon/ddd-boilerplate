import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ensureEnvLoaded } from '@common/application/utils/env.util';
import observabilityConfig from '@config/observability.config';

let sdk: NodeSDK | undefined;

/**
 * OpenTelemetry distributed tracing — bootstrap-level initialization.
 *
 * Must run before the Nest application is created so the instrumentations
 * (HTTP, Fastify, pg, ioredis, amqplib, AWS SDK) patch the modules before
 * first use. Opt-in via `OTEL_TRACING_ENABLED=true` (read from the typed
 * observability config facade — all env vars live in config, not here).
 * This is instrumentation of the process, not a client the app calls —
 * so it lives in bootstrap, not in an infrastructure client folder.
 */
export function configureTracing(): void {
  ensureEnvLoaded();
  const tracing = observabilityConfig().tracing;
  if (!tracing.enabled) return;

  sdk = new NodeSDK({
    serviceName: tracing.serviceName,
    traceExporter: new OTLPTraceExporter({
      ...(tracing.endpoint ? { url: tracing.endpoint } : {}),
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
      new AmqplibInstrumentation(),
      new AwsInstrumentation(),
    ],
  });

  sdk.start();
}

/** Flushes and shuts down the tracer; called from the shutdown hook. */
export async function stopTracing(): Promise<void> {
  await sdk?.shutdown().catch(() => undefined);
  sdk = undefined;
}
