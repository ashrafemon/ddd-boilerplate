import { Vendor } from '../aggregates';

/**
 * Command-side repository port. The adapter injects the transactional host
 * adapter so all writes participate in the use case's @Transactional boundary.
 */
export abstract class VendorCommandRepositoryPort {
  abstract save(vendor: Vendor): Promise<Vendor>;
  abstract update(vendor: Vendor): Promise<Vendor>;
}
