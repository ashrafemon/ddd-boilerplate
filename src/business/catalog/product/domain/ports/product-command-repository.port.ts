import { Product } from '../../domain/entities';
import { ProductId } from '../../domain/value-objects';
import { Sku } from '../../domain/value-objects';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 * Returns/accepts domain aggregates only — never Prisma rows.
 */
export abstract class ProductCommandRepositoryPort {
  abstract save(product: Product): Promise<Product>;
  abstract update(product: Product): Promise<Product>;
  abstract findById(id: ProductId): Promise<Product | null>;
  abstract findBySku(sku: Sku): Promise<Product | null>;
}
