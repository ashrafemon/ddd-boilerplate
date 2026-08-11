import { Injectable } from '@nestjs/common';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { OrganizationConfigurationPort } from '../../../../../shared-kernel/ports/configuration/organization-configuration.port';
import {
  PurchaseOrganizationConfiguration,
  PurchaseOrganizationConfigurationPort,
} from '../../../domain/port/purchase-organization-configuration.port';

const DEFAULT_CONFIG: PurchaseOrganizationConfiguration = {
  approvalLimitCents: 1_000_000,
  requiresAdditionalApprovalLimitCents: 5_000_000,
  numberingPrefix: 'PO',
  nextSequence: 1,
};

/**
 * Purchase-owned configuration adapter over the platform
 * OrganizationConfigurationPort. Configuration lives in the organization
 * record under the "purchase" aggregate key.
 */
@Injectable()
export class PurchaseOrganizationConfigurationAdapter
  implements PurchaseOrganizationConfigurationPort
{
  constructor(
    private readonly organizationConfiguration: OrganizationConfigurationPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async getForOrganization(organizationId: string): Promise<PurchaseOrganizationConfiguration> {
    const tenantId = this.requestContext.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const config = await this.organizationConfiguration.get<Record<string, unknown>>({
      tenantId: TenantId.from(tenantId),
      organizationId: OrganizationId.from(organizationId),
      aggregate: 'purchase',
    });

    if (!config) {
      return { ...DEFAULT_CONFIG };
    }

    return {
      approvalLimitCents: numberOr(config.approvalLimitCents, DEFAULT_CONFIG.approvalLimitCents),
      requiresAdditionalApprovalLimitCents: numberOr(
        config.requiresAdditionalApprovalLimitCents,
        DEFAULT_CONFIG.requiresAdditionalApprovalLimitCents ?? 5_000_000,
      ),
      numberingPrefix: stringOr(config.numberingPrefix, DEFAULT_CONFIG.numberingPrefix),
      nextSequence: numberOr(config.nextSequence, DEFAULT_CONFIG.nextSequence),
    };
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
