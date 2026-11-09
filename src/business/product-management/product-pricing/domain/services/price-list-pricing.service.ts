import { Money } from '@business/shared-business/domain/common/value-objects/money';

export class PriceListPricingService {
  static toMoney(amount: number, currency: string): Money {
    return Money.fromDecimal(amount, currency);
  }

  static lineTotal(unitPrice: number, quantity: number): number {
    return Math.round(unitPrice * quantity * 100) / 100;
  }
}
