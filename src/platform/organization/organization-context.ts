import { OrganizationId } from '../../shared-business/value-object/organization-id';

/**
 * Value object describing the current organization within the tenant.
 */
export class OrganizationContext {
  public readonly organizationId: OrganizationId;
  public readonly code?: string;

  private constructor(organizationId: OrganizationId, code?: string) {
    this.organizationId = organizationId;
    this.code = code;
  }

  public static create(organizationId: OrganizationId, code?: string): OrganizationContext {
    return new OrganizationContext(organizationId, code);
  }
}
