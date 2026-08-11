export interface ProductReadModel {
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  sku: string;
  unit: string;
  status: string;
  isPurchasable: boolean;
  isSellable: boolean;
  priceCents: number;
  currency: string;
  categoryId: string | null;
}

/**
 * Read-side repository for products, optimized for queries/projections.
 */
export abstract class ProductReadRepositoryPort {
  public abstract findById(id: string): Promise<ProductReadModel | null>;

  public abstract findByIds(ids: string[]): Promise<ProductReadModel[]>;

  public abstract findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<ProductReadModel | null>;
}
