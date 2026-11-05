import { Money } from '@business/shared-business/domain/common/value-objects/money';

export class ProductPricingService {
  static toMoney(amount: number, currency: string): Money {
    return Money.fromDecimal(amount, currency);
  }
}
