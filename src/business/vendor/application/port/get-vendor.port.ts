import { GetVendorInput, VendorOutput } from '../type/vendor.output';

/**
 * Public application port of the Vendor bounded context: reads a vendor.
 */
export abstract class GetVendorPort {
  public abstract execute(input: GetVendorInput): Promise<VendorOutput>;
}
