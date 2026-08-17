import { PageQuery, PageResult } from '@shared-kernel/types/pagination';

/**
 * Read-side repository port. The adapter injects the Prisma read service and
 * returns projections directly — query use cases skip the domain entirely and
 * never reconstitute aggregates.
 */
export interface ProductQueryRecord {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  status: string;
  unitPrice: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductQueryRepositoryPort {
  findById(id: string): Promise<ProductQueryRecord | null>;
  findBySku(sku: string): Promise<ProductQueryRecord | null>;
  findPurchasableById(id: string): Promise<ProductQueryRecord | null>;
  findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]>;
  findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>>;
}
