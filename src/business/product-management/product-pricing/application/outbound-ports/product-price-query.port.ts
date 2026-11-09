export abstract class ProductPriceQueryPort {
  abstract findPurchasablePriceForProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<{ price: number; currency: string; source: string } | null>;
}
