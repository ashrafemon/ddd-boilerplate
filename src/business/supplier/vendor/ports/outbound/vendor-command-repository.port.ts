import { Vendor } from '../../domain/entities/vendor.aggregate';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { VendorCode } from '../../domain/value-objects/vendor.vos';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 */
export interface VendorCommandRepositoryPort {
  save(vendor: Vendor): Promise<Vendor>;
  update(vendor: Vendor): Promise<Vendor>;
  findById(id: VendorId): Promise<Vendor | null>;
  findByCode(code: VendorCode): Promise<Vendor | null>;
}

export const VENDOR_COMMAND_REPOSITORY = Symbol('VENDOR_COMMAND_REPOSITORY');
