import { Injectable } from '@nestjs/common';
import { OrganizationId } from '../../shared-business/value-object/organization-id';
import { UnauthorizedException } from '../../shared-kernel/exceptions/unauthorized.exception';
import { RequestContextPort } from '../../shared-kernel/ports/context/request-context.port';
import { OrganizationContext } from './organization-context';
import { OrganizationResolverPort } from '../../shared-kernel/ports/organization/organization-resolver.port';

/**
 * Resolves the organization from the CLS request context.
 */
@Injectable()
export class OrganizationResolverService implements OrganizationResolverPort {
  constructor(private readonly requestContext: RequestContextPort) {}

  public getCurrentOrganizationId(): string | undefined {
    return this.requestContext.getOrganizationId();
  }

  public async resolve(): Promise<OrganizationContext> {
    const organizationId = this.requestContext.getOrganizationId();
    if (!organizationId) {
      throw new UnauthorizedException('Organization context is required');
    }
    return OrganizationContext.create(OrganizationId.from(organizationId));
  }
}
