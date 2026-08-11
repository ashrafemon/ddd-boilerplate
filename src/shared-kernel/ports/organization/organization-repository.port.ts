import { OrganizationId } from '../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../shared-business/value-object/tenant-id';

export interface OrganizationRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  config: Record<string, unknown> | null;
  isActive: boolean;
}

/**
 * Persistence port for organizations.
 */
export abstract class OrganizationRepositoryPort {
  public abstract findById(
    tenantId: TenantId,
    id: OrganizationId,
  ): Promise<OrganizationRecord | null>;
}
