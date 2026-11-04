import { Money } from '@business/shared-business/domain/common/value-objects/money';

export class PurchaseOrderPricingService {
  static lineTotal(unitPrice: Money, quantity: number): Money {
    return unitPrice.multiply(quantity);
  }
}
