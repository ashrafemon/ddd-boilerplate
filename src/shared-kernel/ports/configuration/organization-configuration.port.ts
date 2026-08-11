import { OrganizationId } from '../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../shared-business/value-object/tenant-id';

export interface AggregateConfigQuery {
  tenantId: TenantId;
  organizationId: OrganizationId;
  aggregate: string;
  role?: string;
}

/**
 * Organization configuration capability.
 *
 * Configuration may vary by organization, aggregate and role. Business modules
 * access it through this port instead of hardcoding organization-specific
 * behavior in controllers or use cases.
 */
export abstract class OrganizationConfigurationPort {
  public abstract get<TConfig extends Record<string, unknown>>(
    query: AggregateConfigQuery,
  ): Promise<TConfig | null>;

  public abstract getValue<TValue>(
    query: AggregateConfigQuery,
    key: string,
    fallback?: TValue,
  ): Promise<TValue | null>;
}
