export interface ErrorTrackingContext {
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  organizationId?: string;
  userId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Error tracking abstraction (Sentry by default).
 */
export abstract class ErrorTrackingPort {
  public abstract captureException(error: unknown, context?: ErrorTrackingContext): void;
  public abstract captureMessage(message: string, context?: ErrorTrackingContext): void;
}
