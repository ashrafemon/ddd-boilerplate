import { Module } from '@nestjs/common';
import { ConsoleLoggerAdapter } from './adapters/console-logger.adapter';
import { PrometheusMetricsAdapter } from './adapters/prometheus-metrics.adapter';
import { SentryErrorTrackingAdapter } from './adapters/sentry-error-tracking.adapter';
import { ErrorTrackingPort } from './ports/error-tracking.port';
import { LoggerPort } from './ports/logger.port';
import { MetricsPort } from './ports/metrics.port';

/**
 * Platform observability module — provides logging, metrics and error
 * tracking ports backed by console, Prometheus and Sentry.
 */
@Module({
  providers: [
    { provide: LoggerPort, useClass: ConsoleLoggerAdapter },
    { provide: MetricsPort, useClass: PrometheusMetricsAdapter },
    { provide: ErrorTrackingPort, useClass: SentryErrorTrackingAdapter },
  ],
  exports: [LoggerPort, MetricsPort, ErrorTrackingPort],
})
export class ObservabilityModule {}
