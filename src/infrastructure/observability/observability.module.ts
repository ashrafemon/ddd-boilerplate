import { Global, Module } from '@nestjs/common';
import { ConsoleLoggerAdapter } from './console-logger.adapter';
import { PrometheusMetricsAdapter } from './prometheus-metrics.adapter';
import { SentryErrorTrackingAdapter } from './sentry-error-tracking.adapter';
import { ErrorTrackingPort } from '@shared-kernel/ports/observability/error-tracking.port';
import { LoggerPort } from '@shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '@shared-kernel/ports/observability/metrics.port';

/**
 * Infrastructure observability module. Implements the platform observability
 * ports (logging, metrics, error tracking) with concrete clients.
 *
 * LoggerPort is required by every other infrastructure client (Prisma, Redis,
 * Kafka, ...) so it is always registered here. Sentry initialization happens in
 * the bootstrap layer (`configureSentry`), which is the single init point;
 * the error tracking adapter only reports through the already-initialized SDK.
 */
@Global()
@Module({
  providers: [
    { provide: LoggerPort, useClass: ConsoleLoggerAdapter },
    { provide: MetricsPort, useClass: PrometheusMetricsAdapter },
    { provide: ErrorTrackingPort, useClass: SentryErrorTrackingAdapter },
  ],
  exports: [LoggerPort, MetricsPort, ErrorTrackingPort],
})
export class ObservabilityModule {}
