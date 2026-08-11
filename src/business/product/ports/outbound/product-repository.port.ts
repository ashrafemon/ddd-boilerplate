import { PageQuery } from '@shared-kernal/types/pagination';
import { Product } from '../../domain/entities/product.aggregate';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';

export interface ProductRepositoryPort {
  save(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
  findAll(query: PageQuery): Promise<{ items: Product[]; total: number }>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
