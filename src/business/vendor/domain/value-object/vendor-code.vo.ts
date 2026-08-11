import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

interface VendorCodeProps {
  value: string;
}

/**
 * Business code of a vendor, unique within a tenant/organization.
 */
export class VendorCode extends ValueObject<VendorCodeProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): VendorCode {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9._-]{1,32}$/.test(normalized)) {
      throw new DomainException(`Invalid vendor code: ${String(value)}`, 'INVALID_VENDOR_CODE');
    }
    return new VendorCode(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
