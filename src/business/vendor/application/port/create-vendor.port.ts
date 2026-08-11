import { CreateVendorInput, CreateVendorOutput } from '../type/create-vendor.input';

/**
 * Public application port of the Vendor bounded context: creates a vendor.
 *
 * Other modules access vendor creation only through this port, never through
 * the concrete use case.
 */
export abstract class CreateVendorPort {
  public abstract execute(input: CreateVendorInput): Promise<CreateVendorOutput>;
}
