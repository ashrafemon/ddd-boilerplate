import { PriceListReference } from '../contracts/price-list-reference.contract';

export abstract class PriceListReferencePort {
  abstract findByCode(code: string): Promise<PriceListReference | null>;
  abstract findActiveByCode(code: string): Promise<PriceListReference | null>;
}
