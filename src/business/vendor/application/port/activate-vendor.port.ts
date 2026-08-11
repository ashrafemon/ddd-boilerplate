import {
  ActivateVendorInput,
  ActivateVendorOutput,
  DeactivateVendorInput,
  DeactivateVendorOutput,
} from '../type/vendor-status.input';

/**
 * Public application port of the Vendor bounded context: activates a vendor.
 */
export abstract class ActivateVendorPort {
  public abstract execute(input: ActivateVendorInput): Promise<ActivateVendorOutput>;
}

/**
 * Public application port of the Vendor bounded context: deactivates a vendor.
 */
export abstract class DeactivateVendorPort {
  public abstract execute(input: DeactivateVendorInput): Promise<DeactivateVendorOutput>;
}
