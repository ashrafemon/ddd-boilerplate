import { PriceListPricingService } from './price-list-pricing.service';

describe('PriceListPricingService', () => {
  it('converts a decimal amount to Money', () => {
    const money = PriceListPricingService.toMoney(19.99, 'USD');
    expect(money.minorUnits).toBe(1999);
    expect(money.currency).toBe('USD');
  });

  it('computes the line total rounded to cents', () => {
    expect(PriceListPricingService.lineTotal(10.5, 3)).toBe(31.5);
    expect(PriceListPricingService.lineTotal(0.1, 3)).toBe(0.3);
  });
});
