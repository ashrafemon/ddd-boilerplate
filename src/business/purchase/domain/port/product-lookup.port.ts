export interface ProductLookupInput {
  productId: string;
}

export interface ProductLookupOutput {
  productId: string;
  code: string;
  sku: string;
  name: string;
  unit: string;
  status: string;
  isActive: boolean;
  isPurchasable: boolean;
  priceCents: number;
  currency: string;
}

/**
 * Purchase-owned domain port for product data. The Product bounded context
 * satisfies it through its GetProductPort.
 */
export abstract class ProductLookupPort {
  public abstract findForPurchase(input: ProductLookupInput): Promise<ProductLookupOutput>;
}
