import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorQueryRecord } from '../types/vendor.types';

export abstract class VendorQueryRepositoryPort {
  abstract findById(id: string): Promise<VendorQueryRecord | null>;
  abstract findOrderableById(id: string): Promise<VendorQueryRecord | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>>;
}
