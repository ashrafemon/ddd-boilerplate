import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { NextFunction, Request, Response } from 'express';
import { ConfigurationService } from '../../config/configuration.service';
import { createUuid } from '../../shared-kernel/utilities/uuid';
import { ClsRequestContextService } from '../../infrastructure/context/cls-request-context.service';

/**
 * Populates the CLS request context from HTTP headers before guards run:
 *   x-request-id / x-correlation-id
 *   {TENANT_HEADER}, {ORGANIZATION_HEADER}
 *   x-user-id, x-roles, accept-language
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: ClsRequestContextService,
    private readonly configuration: ConfigurationService,
    private readonly cls: ClsService,
  ) {}

  public use(request: Request, _response: Response, next: NextFunction): void {
    const correlationId = (request.headers['x-correlation-id'] as string) || createUuid();
    const requestId = (request.headers['x-request-id'] as string) || createUuid();

    request.headers['x-correlation-id'] = correlationId;
    request.headers['x-request-id'] = requestId;

    const context = {
      requestId,
      correlationId,
      tenantId: (request.headers[this.configuration.tenantHeader] as string) || undefined,
      organizationId:
        (request.headers[this.configuration.organizationHeader] as string) || undefined,
      userId: (request.headers['x-user-id'] as string) || undefined,
      roles:
        (request.headers['x-roles'] as string)?.split(',').map((role) => role.trim()).filter(Boolean) ??
        [],
      locale: (request.headers['accept-language'] as string) || 'en',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (this.cls.isActive()) {
      this.requestContext.set(context);
      next();
      return;
    }

    this.cls.run(() => {
      this.requestContext.set(context);
      next();
    });
  }
}
