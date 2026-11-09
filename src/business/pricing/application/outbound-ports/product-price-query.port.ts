import { PriceListQueryRecord } from '../../domain/types/price-list.types';

export abstract class ProductPriceQueryPort {
  abstract findPurchasablePriceForProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<{ price: number; currency: string; source: string } | null>;
}
