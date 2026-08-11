import { Identifier } from '@business/shared-business/domain/identifier';

export class PurchaseOrderId extends Identifier {
  static fromString(value: string): PurchaseOrderId {
    return new PurchaseOrderId(value);
  }

  static generate(): PurchaseOrderId {
    return new PurchaseOrderId(Identifier.create());
  }
}
