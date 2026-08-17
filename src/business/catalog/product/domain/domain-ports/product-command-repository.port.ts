import { Product } from '../../domain/entities';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 * Returns/accepts domain aggregates only — never Prisma rows.
 */
export interface ProductCommandRepositoryPort {
  save(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
}
