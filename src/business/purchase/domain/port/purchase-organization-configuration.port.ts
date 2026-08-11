export interface PurchaseOrganizationConfiguration {
  approvalLimitCents: number;
  requiresAdditionalApprovalLimitCents?: number;
  numberingPrefix: string;
  nextSequence: number;
}

/**
 * Purchase-owned port for organization configuration relevant to purchase
 * orders (approval limits, numbering). Implemented by an infrastructure
 * adapter over the platform OrganizationConfigurationPort.
 */
export abstract class PurchaseOrganizationConfigurationPort {
  public abstract getForOrganization(
    organizationId: string,
  ): Promise<PurchaseOrganizationConfiguration>;
}
