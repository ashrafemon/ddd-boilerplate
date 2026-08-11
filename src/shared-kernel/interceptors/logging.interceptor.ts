import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { REQUEST_ID_KEY, CORRELATION_ID_KEY } from './request-id.interceptor';

/**
 * Structured request logging: requestId, correlationId, method, path,
 * statusCode and duration. Never logs bodies or sensitive headers.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const response = http.getResponse<FastifyReply>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, startedAt),
        error: (err: Error) => {
          const status = 'status' in err ? (err as { status: number }).status : 500;
          this.log(request, typeof status === 'number' ? status : 500, startedAt, err.message);
        },
      }),
    );
  }

  private log(
    request: FastifyRequest,
    statusCode: number,
    startedAt: number,
    error?: string,
  ): void {
    const duration = Date.now() - startedAt;
    const requestId = this.cls.get<string>(REQUEST_ID_KEY);
    const correlationId = this.cls.get<string>(CORRELATION_ID_KEY);

    const entry = {
      requestId,
      correlationId,
      method: request.method,
      path: request.url,
      statusCode,
      durationMs: duration,
      ...(error ? { error } : {}),
    };

    if (statusCode >= 500) {
      this.logger.error(JSON.stringify(entry));
    } else {
      this.logger.log(JSON.stringify(entry));
    }
  }
}
