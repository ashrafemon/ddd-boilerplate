import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiMeta, ApiSuccess } from '../../types/api-response';

/**
 * Wraps successful responses in a consistent envelope carrying the request
 * and correlation ids for tracing.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextPort) {}

  public intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const envelope: ApiSuccess<unknown> = {
          success: true,
          data,
          meta: this.buildMeta(),
          timestamp: new Date().toISOString(),
        };
        return envelope;
      }),
    );
  }

  private buildMeta(): ApiMeta {
    return {
      requestId: this.requestContext.getRequestId(),
      correlationId: this.requestContext.getCorrelationId(),
    };
  }
}
