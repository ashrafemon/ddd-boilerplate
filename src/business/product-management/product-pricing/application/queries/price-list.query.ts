import { PageQuery, PageResult } from '@common/application/types/pagination';
import { PriceListQueryRecord, GetProductPriceResult } from '../../domain/types/price-list.types';

export abstract class PriceListQuery {
  abstract findById(id: string): Promise<PriceListQueryRecord | null>;
  abstract findByCode(code: string): Promise<PriceListQueryRecord | null>;
  abstract findActiveByCode(code: string): Promise<PriceListQueryRecord | null>;
  abstract findPurchasablePriceForProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<GetProductPriceResult | null>;
  abstract findAll(query: PageQuery): Promise<PageResult<PriceListQueryRecord>>;
}
