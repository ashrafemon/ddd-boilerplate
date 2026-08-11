import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RequestContextPort } from '../../ports/context/request-context.port';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { ConfigurationService } from '../../../config/configuration.service';

/**
 * Extracts tenant, organization, user and locale context from HTTP headers and
 * stores it in CLS so every downstream layer is tenancy-aware.
 *
 * Headers used:
 *   {TENANT_HEADER}       (default x-tenant-id)
 *   {ORGANIZATION_HEADER} (default x-organization-id)
 *   x-user-id
 *   accept-language
 *   x-roles              (comma separated)
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    private readonly requestContext: RequestContextPort,
    private readonly configuration: ConfigurationService,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tenantHeader = this.configuration.tenantHeader;
    const organizationHeader = this.configuration.organizationHeader;

    const tenantId = (request.headers[tenantHeader] as string) || undefined;
    const organizationId = (request.headers[organizationHeader] as string) || undefined;
    const userId = (request.headers['x-user-id'] as string) || undefined;
    const locale = (request.headers['accept-language'] as string) || 'en';
    const roles = (request.headers['x-roles'] as string)?.split(',').map((r) => r.trim()).filter(Boolean) ?? [];
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];

    this.requestContext.set({ tenantId, organizationId, userId, locale, roles, ip, userAgent });

    return next.handle();
  }
}
