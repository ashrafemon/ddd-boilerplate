import { PageQuery } from '@shared-kernel/types/pagination';
import { Vendor } from '../../domain/entities/vendor.aggregate';
import { VendorCode } from '../../domain/value-objects/vendor.vos';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';

export interface VendorRepositoryPort {
  save(vendor: Vendor): Promise<Vendor>;
  update(vendor: Vendor): Promise<Vendor>;
  findById(id: VendorId): Promise<Vendor | null>;
  findByCode(code: VendorCode): Promise<Vendor | null>;
  findAll(query: PageQuery): Promise<{ items: Vendor[]; total: number }>;
}

export const VENDOR_REPOSITORY = Symbol('VENDOR_REPOSITORY');
