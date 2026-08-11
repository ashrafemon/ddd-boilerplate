import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import {
  CLS_REQUEST_CONTEXT_KEY,
  RequestContext,
  RequestContextData,
} from '@shared-kernel/ports/context/request-context';

export const REQUEST_ID_KEY = 'requestId';
export const CORRELATION_ID_KEY = 'correlationId';

/**
 * Generates a request id and propagates an optional inbound correlation id
 * into the CLS context so logging and outbox messages stay traceable. Also
 * seeds the immutable `requestContext` snapshot read by RequestContextPort.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    const incoming = (request.headers['x-correlation-id'] as string) ?? undefined;
    const requestId = randomUUID();
    const correlationId = incoming ?? requestId;

    this.cls.set(REQUEST_ID_KEY, requestId);
    this.cls.set(CORRELATION_ID_KEY, correlationId);

    const headers = request.headers;
    this.cls.set(
      CLS_REQUEST_CONTEXT_KEY,
      RequestContext.create({
        requestId,
        correlationId,
        tenantId: (headers['x-tenant-id'] as string) ?? undefined,
        organizationId: (headers['x-organization-id'] as string) ?? undefined,
        userId: (headers['x-user-id'] as string) ?? undefined,
        roles:
          (headers['x-roles'] as string)
            ?.split(',')
            .map(r => r.trim())
            .filter(Boolean) ?? [],
        locale: (headers['accept-language'] as string) || 'en',
        ip: request.ip,
        userAgent: headers['user-agent'],
      } satisfies RequestContextData),
    );

    return next.handle();
  }
}
