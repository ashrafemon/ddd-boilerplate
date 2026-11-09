import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@config/config.service';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import {
  VERIFIED_IDENTITY_REQUEST_KEY,
  VerifiedIdentity,
} from '@platform/platform-common/context/guards/tenancy-auth.guard';

export const REQUEST_ID_KEY = 'requestId';
export const CORRELATION_ID_KEY = 'correlationId';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextPort,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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

    this.requestContext.set({
      requestId,
      correlationId,
      tenantId: identity.tenantId,
      companyId: identity.companyId,
      userId: identity.userId,
      roles: identity.roles,
      locale: request.headers['accept-language'] ?? 'en',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

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
