import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrderPricingService } from './purchase-order-pricing.service';

describe('PurchaseOrderPricingService', () => {
  it('converts decimal amount to minor units', () => {
    expect(PurchaseOrderPricingService.toMinorUnits(12.34, 'USD')).toBe(1234);
  });

  it('maps line unit prices to minor units', () => {
    const result = PurchaseOrderPricingService.toLineUnitPrices(
      { 'prod-1': 10.5, 'prod-2': 3 },
      'USD',
    );
    expect(result).toEqual({ 'prod-1': 1050, 'prod-2': 300 });
  });

  it('calculates line total', () => {
    const total = PurchaseOrderPricingService.lineTotal(Money.fromMinorUnits(250, 'USD'), 4);
    expect(total.minorUnits).toBe(1000);
    expect(total.currency).toBe('USD');
  });
});
