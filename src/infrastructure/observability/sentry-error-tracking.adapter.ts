import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigurationService } from '../../config/configuration.service';
import { ErrorTrackingContext, ErrorTrackingPort } from '../../shared-kernel/ports/observability/error-tracking.port';

/**
 * Sentry-backed error tracking. Initializes lazily only when SENTRY_DSN is
 * configured so local development works without Sentry.
 */
@Injectable()
export class SentryErrorTrackingAdapter implements ErrorTrackingPort, OnModuleInit {
  private enabled = false;

  constructor(private readonly configuration: ConfigurationService) {}

  public onModuleInit(): void {
    const sentry = this.configuration.getSentry();
    if (sentry.enabled && sentry.dsn) {
      Sentry.init({
        dsn: sentry.dsn,
        environment: this.configuration.env,
        tracesSampleRate: this.configuration.isProduction ? 0.1 : 1.0,
      });
      this.enabled = true;
    }
  }

  public captureException(error: unknown, context?: ErrorTrackingContext): void {
    if (!this.enabled) return;
    Sentry.withScope((scope) => {
      this.applyContext(scope, context);
      Sentry.captureException(error);
    });
  }

  public captureMessage(message: string, context?: ErrorTrackingContext): void {
    if (!this.enabled) return;
    Sentry.withScope((scope) => {
      this.applyContext(scope, context);
      Sentry.captureMessage(message);
    });
  }

  private applyContext(scope: Sentry.Scope, context?: ErrorTrackingContext): void {
    if (!context) return;
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.correlationId) scope.setTag('correlationId', context.correlationId);
    if (context.tenantId) scope.setTag('tenantId', context.tenantId);
    if (context.organizationId) scope.setTag('organizationId', context.organizationId);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.tags) scope.setTags(context.tags);
    if (context.extra) scope.setExtras(context.extra);
  }
}
