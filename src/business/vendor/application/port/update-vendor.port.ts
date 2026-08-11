import { UpdateVendorInput, UpdateVendorOutput } from '../type/update-vendor.input';

/**
 * Public application port of the Vendor bounded context: updates a vendor.
 */
export abstract class UpdateVendorPort {
  public abstract execute(input: UpdateVendorInput): Promise<UpdateVendorOutput>;
}
