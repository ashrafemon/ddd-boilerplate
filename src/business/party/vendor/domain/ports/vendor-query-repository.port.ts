import { PageQuery, PageResult } from '@shared-kernel/types/pagination';

/**
 * Read-side repository port. The adapter injects the Prisma read service and
 * returns projections directly — query use cases skip the domain.
 */
export interface VendorQueryRecord {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class VendorQueryRepositoryPort {
  abstract findById(id: string): Promise<VendorQueryRecord | null>;
  abstract findOrderableById(id: string): Promise<VendorQueryRecord | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>>;
}
