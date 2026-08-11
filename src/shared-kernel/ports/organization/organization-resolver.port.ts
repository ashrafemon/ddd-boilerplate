import { OrganizationContext } from '../../../platform/organization/organization-context';

/**
 * Resolves the current organization independently from the tenant.
 * Organization is a separate platform concept: one tenant may contain many
 * organizations.
 */
export abstract class OrganizationResolverPort {
  public abstract resolve(): Promise<OrganizationContext>;
  public abstract getCurrentOrganizationId(): string | undefined;
}
