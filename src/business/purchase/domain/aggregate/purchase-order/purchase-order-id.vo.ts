import { Identifier } from '../../../../../shared-business/domain/identifier';

export class PurchaseOrderId extends Identifier {
  public static from(value: string): PurchaseOrderId {
    return new PurchaseOrderId(value);
  }
}
