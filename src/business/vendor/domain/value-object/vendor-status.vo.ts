import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

export enum VendorStatusValue {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

interface VendorStatusProps {
  value: VendorStatusValue;
}

/**
 * Status of a vendor within the Vendor bounded context.
 */
export class VendorStatus extends ValueObject<VendorStatusProps> {
  private constructor(value: VendorStatusValue) {
    super({ value });
  }

  public static from(value: string): VendorStatus {
    if (!Object.values(VendorStatusValue).includes(value as VendorStatusValue)) {
      throw new DomainException(`Invalid vendor status: ${String(value)}`, 'INVALID_VENDOR_STATUS');
    }
    return new VendorStatus(value as VendorStatusValue);
  }

  public static active(): VendorStatus {
    return new VendorStatus(VendorStatusValue.ACTIVE);
  }

  public static inactive(): VendorStatus {
    return new VendorStatus(VendorStatusValue.INACTIVE);
  }

  public getValue(): VendorStatusValue {
    return this.props.value;
  }

  public canTransitionTo(target: VendorStatusValue): boolean {
    const allowed: Record<VendorStatusValue, VendorStatusValue[]> = {
      [VendorStatusValue.ACTIVE]: [VendorStatusValue.INACTIVE],
      [VendorStatusValue.INACTIVE]: [VendorStatusValue.ACTIVE],
    };
    return (allowed[this.props.value] ?? []).includes(target);
  }

  public isActive(): boolean {
    return this.props.value === VendorStatusValue.ACTIVE;
  }
}
