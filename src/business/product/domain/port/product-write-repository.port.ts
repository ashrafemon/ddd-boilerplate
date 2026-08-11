import { ProductId } from '../aggregate/product/product-id.vo';
import { Product } from '../aggregate/product/product.entity';
import { ProductStatusValue } from '../value-object/product-status.vo';

/**
 * Explicit persistence model for the Product write repository.
 *
 * The repository never receives the aggregate. The use case assembles this
 * plain data from the input DTO, the tenant/organization context and the
 * domain identity. The domain is used only to enforce invariants/policies and
 * record domain events; it never generates persistence data.
 *
 * The discriminated union makes creates (all fields required) distinct from
 * partial updates (only the changed fields), so infrastructure never has to
 * guess defaults or cast.
 */
export type ProductPersistenceData =
  | ProductCreatePersistenceData
  | ProductUpdatePersistenceData;

export interface ProductCreatePersistenceData {
  operation: 'create';
  id: string;
  tenantId: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  sku: string;
  unit: string;
  status: ProductStatusValue;
  isPurchasable: boolean;
  isSellable: boolean;
  priceCents: number;
  currency: string;
  categoryId?: string | null;
}

export interface ProductUpdatePersistenceData {
  operation: 'update';
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  sku?: string;
  unit?: string;
  status?: ProductStatusValue;
  isPurchasable?: boolean;
  isSellable?: boolean;
  priceCents?: number;
  currency?: string;
  categoryId?: string | null;
}

/**
 * Write-side repository for the Product aggregate.
 *
 * Domain-owned port: the Product bounded context needs persistence. The
 * consumer (Product) owns this port; infrastructure implements it.
 */
export abstract class ProductWriteRepositoryPort {
  public abstract save(data: ProductPersistenceData): Promise<void>;

  public abstract findById(id: ProductId): Promise<Product | null>;

  public abstract findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<Product | null>;
}
