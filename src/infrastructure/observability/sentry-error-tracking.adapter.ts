import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '../../config/config.service';
import {
  ErrorTrackingContext,
  ErrorTrackingPort,
} from '../../shared-kernel/ports/observability/error-tracking.port';

/**
 * Sentry-backed error tracking. Self-disables when SENTRY_DSN is not
 * configured so local development works without Sentry. Sentry.init is called
 * once by the bootstrap layer (configureSentry); this adapter only reports.
 */
@Injectable()
export class SentryErrorTrackingAdapter implements ErrorTrackingPort {
  private readonly enabled: boolean;

  constructor(configuration: ConfigService) {
    const sentry = configuration.getSentry();
    this.enabled = Boolean(sentry.dsn);
  }

  public captureException(error: unknown, context?: ErrorTrackingContext): void {
    if (!this.enabled) return;
    Sentry.withScope(scope => {
      this.applyContext(scope, context);
      Sentry.captureException(error);
    });
  }

  public captureMessage(message: string, context?: ErrorTrackingContext): void {
    if (!this.enabled) return;
    Sentry.withScope(scope => {
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
