import { PageQuery, PageResult } from '@shared-kernel/types/pagination';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';

export interface VendorSummary {
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

/**
 * Cross-module inbound port. Other business modules (e.g. purchase-order)
 * depend on this abstraction — never on VendorRepository or its Prisma model.
 */
export interface VendorQueryPort {
  getVendor(id: VendorId): Promise<VendorSummary | null>;
  getOrderableVendor(id: VendorId): Promise<VendorSummary | null>;
  listVendors(query: PageQuery): Promise<PageResult<VendorSummary>>;
}

export const VENDOR_QUERY_PORT = Symbol('VENDOR_QUERY_PORT');
