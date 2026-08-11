import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerPort } from '../../ports/observability/logger.port';

/**
 * Structured request logging with correlation context and duration.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = context.switchToHttp().getResponse().statusCode;
          this.logger.info('http-request', {
            method,
            path: originalUrl,
            statusCode,
            durationMs: Date.now() - startedAt,
            requestId: this.requestContext.getRequestId(),
            correlationId: this.requestContext.getCorrelationId(),
            tenantId: this.requestContext.getTenantId(),
            organizationId: this.requestContext.getOrganizationId(),
          });
        },
        error: (error: unknown) => {
          this.logger.warn('http-request-failed', {
            method,
            path: originalUrl,
            durationMs: Date.now() - startedAt,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
            requestId: this.requestContext.getRequestId(),
            correlationId: this.requestContext.getCorrelationId(),
            tenantId: this.requestContext.getTenantId(),
            organizationId: this.requestContext.getOrganizationId(),
          });
        },
      }),
    );
  }
}
