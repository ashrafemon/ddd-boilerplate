import { Money } from '@business/shared-business/domain/common/value-objects/money';

export class PurchaseOrderPricingService {
  static toMoney(amount: number, currency: string): Money {
    return Money.fromDecimal(amount, currency);
  }
  static toLineUnitPrices(
    lineUnitPrices: Record<string, number> | undefined,
    currency: string,
  ): Record<string, number> | undefined {
    if (!lineUnitPrices) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(lineUnitPrices).map(([productId, amount]) => [
        productId,
        PurchaseOrderPricingService.toMinorUnits(amount, currency),
      ]),
    );
  }
  static toMinorUnits(amount: number, currency: string): number {
    return Money.fromDecimal(amount, currency).minorUnits;
  }

  static lineTotal(unitPrice: Money, quantity: number): Money {
    return unitPrice.multiply(quantity);
  }
}
