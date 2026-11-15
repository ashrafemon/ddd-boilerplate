import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { ProductPricingService } from './product-pricing.service';

describe('ProductPricingService', () => {
  it('converts a decimal amount to Money', () => {
    const money = ProductPricingService.toMoney(19.99, 'USD');
    expect(money).toBeInstanceOf(Money);
    expect(money.minorUnits).toBe(1999);
    expect(money.currency).toBe('USD');
  });

  it('supports other currencies', () => {
    expect(ProductPricingService.toMoney(10, 'EUR').currency).toBe('EUR');
  });
});
