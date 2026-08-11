import { Identifier } from '../../../../shared-business/domain/identifier';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';

export class VendorAddressId extends Identifier {
  public static from(value: string): VendorAddressId {
    return new VendorAddressId(value);
  }

  public static create(): VendorAddressId {
    return new VendorAddressId(createUuid());
  }
}
