import { TenantId } from '../../../shared-business/value-object/tenant-id';

export interface TenantRecord {
  id: string;
  code: string;
  name: string;
}

/**
 * Persistence port for tenants. Implemented by an infrastructure adapter
 * backed by PrismaReadService.
 */
export abstract class TenantRepositoryPort {
  public abstract findById(id: TenantId): Promise<TenantRecord | null>;
}
