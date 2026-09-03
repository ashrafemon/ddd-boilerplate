import { Product } from '../aggregates';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 * Returns/accepts domain aggregates only — never Prisma rows.
 */
export abstract class ProductCommandRepositoryPort {
  abstract findById(id: string): Promise<Product | null>;
  abstract findBySku(sku: string): Promise<Product | null>;
  abstract save(product: Product): Promise<Product>;
  abstract update(product: Product): Promise<Product>;
}
