import { Vendor } from '../../domain/entities';
import { VendorId } from '../../domain/value-objects';
import { VendorCode } from '../../domain/value-objects';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 */
export abstract class VendorCommandRepositoryPort {
  abstract save(vendor: Vendor): Promise<Vendor>;
  abstract update(vendor: Vendor): Promise<Vendor>;
  abstract findById(id: VendorId): Promise<Vendor | null>;
  abstract findByCode(code: VendorCode): Promise<Vendor | null>;
}
