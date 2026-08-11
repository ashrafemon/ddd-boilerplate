import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Policy } from '../../../../shared-business/policy/policy';

export interface ProductPurchasabilityContext {
  productId: string;
  status: 'ACTIVE' | 'INACTIVE';
  isPurchasable: boolean;
  organizationId: OrganizationId;
}

/**
 * Decides whether a product can be purchased by an organization: it must be
 * active and flagged as purchasable.
 */
export class ProductPurchasabilityPolicy extends Policy<ProductPurchasabilityContext> {
  public readonly name = 'product-purchasability';

  public evaluate(
    context: ProductPurchasabilityContext,
  ): { isAllowed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (context.status !== 'ACTIVE') {
      reasons.push(`Product ${context.productId} is not active`);
    }
    if (!context.isPurchasable) {
      reasons.push(`Product ${context.productId} is not purchasable`);
    }
    return { isAllowed: reasons.length === 0, reasons };
  }
}
