import { PriceListReactivationPolicy } from './reactivation.policy';
import { PriceListStatus } from '../types/price-list.enum';

describe('PriceListReactivationPolicy', () => {
  it('allows reactivating a DRAFT list', () => {
    expect(PriceListReactivationPolicy.enforcePriceListReactivation(PriceListStatus.DRAFT)).toBe(
      true,
    );
  });

  it('allows reactivating an ACTIVE list', () => {
    expect(PriceListReactivationPolicy.enforcePriceListReactivation(PriceListStatus.ACTIVE)).toBe(
      true,
    );
  });

  it('blocks reactivating an ARCHIVED list', () => {
    expect(PriceListReactivationPolicy.enforcePriceListReactivation(PriceListStatus.ARCHIVED)).toBe(
      false,
    );
  });
});
