import { ValueObject } from '../../../../shared-business/domain/value-object';

interface VendorReferenceProps {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
}

/**
 * Lightweight reference to a Vendor from the Vendor bounded context.
 * The Purchase context owns this value object; it never imports Vendor
 * domain types directly.
 */
export class VendorReference extends ValueObject<VendorReferenceProps> {
  private constructor(props: VendorReferenceProps) {
    super(props);
  }

  public static from(vendorId: string, vendorCode: string, vendorName: string): VendorReference {
    return new VendorReference({ vendorId, vendorCode, vendorName });
  }

  public getVendorId(): string {
    return this.props.vendorId;
  }

  public getVendorCode(): string {
    return this.props.vendorCode;
  }

  public getVendorName(): string {
    return this.props.vendorName;
  }
}
