import { Identifier } from '../../../../../shared-business/domain/identifier';

export class VendorId extends Identifier {
  public static from(value: string): VendorId {
    return new VendorId(value);
  }
}
