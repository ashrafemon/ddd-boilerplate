import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@config/config.service';
import {
  VERIFIED_IDENTITY_REQUEST_KEY,
  VerifiedIdentity,
} from '@platform/context/guards/tenancy-auth.guard';
import {
  CLS_REQUEST_CONTEXT_KEY,
  RequestContext,
  RequestContextData,
} from '@platform/context/ports/request-context';

export const REQUEST_ID_KEY = 'requestId';
export const CORRELATION_ID_KEY = 'correlationId';

/**
 * Generates a request id and propagates an optional inbound correlation id
 * into the CLS context so logging and outbox messages stay traceable. Also
 * seeds the immutable `requestContext` snapshot read by RequestContextPort.
 *
 * Identity source: with `TENANCY_MODE=multi` the verified identity stashed on
 * the request by `TenancyAuthGuard` (JWT claims) is the only accepted source;
 * raw `x-tenant-id` style headers are ignored. In `single` mode the headers
 * remain trusted (internal deployments / verified gateways).
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // The interceptor is global, so it also sees the platform's non-HTTP
    // transports. A message handler has no HTTP request, no headers to read a
    // correlation id from, and — outside a request — no CLS context to write
    // into. The identity and the correlation of a message travel in the
    // envelope and are restored by the platform before the handler runs
    // (`RequestContextPort.run`), so there is nothing to do here.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    const incoming = (request.headers['x-correlation-id'] as string) ?? undefined;
    const requestId = randomUUID();
    const correlationId = incoming ?? requestId;

    this.cls.set(REQUEST_ID_KEY, requestId);
    this.cls.set(CORRELATION_ID_KEY, correlationId);

    const identity = this.resolveIdentity(request);

    this.cls.set(
      CLS_REQUEST_CONTEXT_KEY,
      RequestContext.create({
        requestId,
        correlationId,
        tenantId: identity.tenantId,
        companyId: identity.companyId,
        userId: identity.userId,
        roles: identity.roles,
        locale: (request.headers['accept-language'] as string) || 'en',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      } satisfies RequestContextData),
    );

    return next.handle();
  }

  private resolveIdentity(request: FastifyRequest): VerifiedIdentity {
    const stored = (request as unknown as Record<string, unknown>)[
      VERIFIED_IDENTITY_REQUEST_KEY
    ] as VerifiedIdentity | undefined;
    if (stored) {
      return stored;
    }

    if (this.config.getSecurity().tenancy.mode === 'multi') {
      return { roles: [] };
    }

    // Outside HTTP there are no headers: the identity travels in the envelope
    // and is restored by the platform before the handler runs.
    const headers = request?.headers ?? {};
    return {
      tenantId: (headers['x-tenant-id'] as string) ?? undefined,
      companyId: (headers['x-company-id'] as string) ?? undefined,
      userId: (headers['x-user-id'] as string) ?? undefined,
      roles:
        (headers['x-roles'] as string)
          ?.split(',')
          .map(r => r.trim())
          .filter(Boolean) ?? [],
    };
  }
}
