export interface VendorReadModel {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  status: string;
  email: string | null;
  phone: string | null;
  taxIdentifier: string | null;
  addresses: Array<{
    id: string;
    type: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string | null;
    country: string;
  }>;
}

/**
 * Read-side repository optimized for queries/projections.
 */
export abstract class VendorReadRepositoryPort {
  public abstract findById(id: string): Promise<VendorReadModel | null>;

  public abstract findByIds(ids: string[]): Promise<VendorReadModel[]>;

  public abstract findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<VendorReadModel | null>;
}
