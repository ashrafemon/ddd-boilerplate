import { PriceList } from '../aggregates/price-list.aggregate';

export abstract class PriceListCommandRepository {
  abstract findById(id: string): Promise<PriceList | null>;
  abstract findByCode(code: string): Promise<PriceList | null>;
  abstract save(priceList: PriceList): Promise<PriceList>;
  abstract update(priceList: PriceList): Promise<PriceList>;
}
