import { Identifier } from '@business/shared-business/domain/identifier';

export class VendorId extends Identifier {
  static fromString(value: string): VendorId {
    return new VendorId(value);
  }

  static generate(): VendorId {
    return new VendorId(Identifier.create());
  }
}
