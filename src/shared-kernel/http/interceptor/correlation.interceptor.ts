import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { createUuid } from '../../utilities/uuid';

/**
 * Ensures every request has a requestId and correlationId (taken from
 * `x-correlation-id` when present, otherwise generated) stored in CLS.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextPort) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string) || createUuid();
    const requestId = createUuid();

    request.headers['x-correlation-id'] = correlationId;
    request.headers['x-request-id'] = requestId;

    this.requestContext.set({ requestId, correlationId });

    return next.handle();
  }
}
