import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';

export const REQUEST_ID_KEY = 'requestId';
export const CORRELATION_ID_KEY = 'correlationId';

/**
 * Generates a request id and propagates an optional inbound correlation id
 * into the CLS context so logging and outbox messages stay traceable.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    const incoming = (request.headers['x-correlation-id'] as string) ?? undefined;
    const requestId = randomUUID();

    this.cls.set(REQUEST_ID_KEY, requestId);
    this.cls.set(CORRELATION_ID_KEY, incoming ?? requestId);

    return next.handle();
  }
}
