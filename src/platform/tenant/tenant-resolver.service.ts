import { Injectable } from '@nestjs/common';
import { TenantId } from '../../shared-business/value-object/tenant-id';
import { UnauthorizedException } from '../../shared-kernel/exceptions/unauthorized.exception';
import { RequestContextPort } from '../../shared-kernel/ports/context/request-context.port';
import { TenantContext } from './tenant-context';
import { TenantResolverPort } from '../../shared-kernel/ports/tenant/tenant-resolver.port';

/**
 * Resolves the tenant from the CLS request context. The context is populated
 * by the RequestContextInterceptor from the configured tenant header and
 * re-established in message consumers before the consuming use case runs.
 */
@Injectable()
export class TenantResolverService implements TenantResolverPort {
  constructor(private readonly requestContext: RequestContextPort) {}

  public getCurrentTenantId(): string | undefined {
    return this.requestContext.getTenantId();
  }

  public async resolve(): Promise<TenantContext> {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return TenantContext.create(TenantId.from(tenantId));
  }
}
