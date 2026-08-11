import { Global, Module } from '@nestjs/common';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { MetricsPort } from '../../shared-kernel/ports/observability/metrics.port';
import { ErrorTrackingPort } from '../../shared-kernel/ports/observability/error-tracking.port';
import { PinoLoggerAdapter } from './pino-logger.adapter';
import { PrometheusMetricsAdapter } from './prometheus-metrics.adapter';
import { SentryErrorTrackingAdapter } from './sentry-error-tracking.adapter';

/**
 * Infrastructure observability module. Implements the platform observability
 * ports (logging, metrics, error tracking) with concrete clients.
 */
@Global()
@Module({
  providers: [
    { provide: LoggerPort, useClass: PinoLoggerAdapter },
    { provide: MetricsPort, useClass: PrometheusMetricsAdapter },
    PrometheusMetricsAdapter,
    { provide: ErrorTrackingPort, useClass: SentryErrorTrackingAdapter },
  ],
  exports: [LoggerPort, MetricsPort, ErrorTrackingPort],
})
export class ObservabilityModule {}
