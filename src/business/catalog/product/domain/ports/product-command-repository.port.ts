import { Product } from '../../domain/entities';
import { ProductId } from '../../domain/value-objects';
import { Sku } from '../../domain/value-objects';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 * Returns/accepts domain aggregates only — never Prisma rows.
 */
export interface ProductCommandRepositoryPort {
  save(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
}

export const PRODUCT_COMMAND_REPOSITORY = Symbol('PRODUCT_COMMAND_REPOSITORY');
