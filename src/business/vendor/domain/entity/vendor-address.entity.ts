import { Address } from '../../../../shared-business/value-object/address';
import { Entity } from '../../../../shared-business/domain/entity';
import { VendorAddressId } from './vendor-address-id.vo';

/**
 * Address belonging to a Vendor. Part of the Vendor aggregate: it must only
 * be modified through the Vendor aggregate root.
 */
export class VendorAddress extends Entity<VendorAddressId> {
  private readonly type: string;
  private readonly address: Address;

  private constructor(id: VendorAddressId, type: string, address: Address) {
    super(id);
    this.type = type;
    this.address = address;
  }

  public static create(type: string, address: Address): VendorAddress {
    return new VendorAddress(VendorAddressId.create(), type, address);
  }

  public static reconstitute(id: VendorAddressId, type: string, address: Address): VendorAddress {
    return new VendorAddress(id, type, address);
  }

  public getType(): string {
    return this.type;
  }

  public getAddress(): Address {
    return this.address;
  }
}
