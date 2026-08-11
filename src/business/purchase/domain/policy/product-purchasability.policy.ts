import { Policy } from '../../../../shared-business/policy/policy';

export interface ProductPurchasabilityContext {
  productId: string;
  sku: string;
  productActive: boolean;
  isPurchasable: boolean;
}

/**
 * A product can only be ordered if it is active and marked as purchasable.
 * Product data arrives through the purchase-owned ProductLookupPort.
 */
export class ProductPurchasabilityPolicy extends Policy<ProductPurchasabilityContext> {
  public readonly name = 'product-purchasability';

  public evaluate(context: ProductPurchasabilityContext): { isAllowed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (!context.productActive) {
      reasons.push(`Product ${context.productId} (${context.sku}) is not active`);
    }
    if (!context.isPurchasable) {
      reasons.push(`Product ${context.productId} (${context.sku}) is not purchasable`);
    }
    return { isAllowed: reasons.length === 0, reasons };
  }
}
