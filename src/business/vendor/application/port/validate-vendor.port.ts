import { ValidateVendorInput, ValidateVendorOutput } from '../type/validate-vendor.output';

/**
 * Public application port of the Vendor bounded context: validates a vendor
 * for use by other modules (e.g. the Purchase bounded context).
 */
export abstract class ValidateVendorPort {
  public abstract execute(input: ValidateVendorInput): Promise<ValidateVendorOutput>;
}
