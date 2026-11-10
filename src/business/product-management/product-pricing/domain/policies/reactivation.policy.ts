import { PriceListStatus } from '../types/price-list.enum';

export class PriceListReactivationPolicy {
  static enforcePriceListReactivation(status: PriceListStatus): boolean {
    return status !== PriceListStatus.ARCHIVED;
  }
}
