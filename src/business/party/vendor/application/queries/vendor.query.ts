import { PageQuery, PageResult } from '@common/application/types/pagination';
import { VendorQueryRecord } from '../../domain/types/vendor.types';

export abstract class VendorQuery {
  abstract findById(id: string): Promise<VendorQueryRecord | null>;
  abstract findOrderableById(id: string): Promise<VendorQueryRecord | null>;
  abstract findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]>;
  abstract findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>>;
}
