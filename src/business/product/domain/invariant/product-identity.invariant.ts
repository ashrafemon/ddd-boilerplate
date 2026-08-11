import { Invariant } from '../../../../shared-business/invariant/invariant';

export interface ProductCoreContext {
  name: string;
  skuValue: string;
  code: string;
}

/**
 * A product must always have a name and a valid, non-empty SKU.
 */
export class ProductIdentityInvariant extends Invariant {
  public readonly name = 'product-identity-must-be-valid';

  public check(context: ProductCoreContext): { isValid: boolean; messages: string[] } {
    const messages: string[] = [];
    if (!context.name?.trim()) {
      messages.push('Product name is required');
    }
    if (!context.skuValue?.trim()) {
      messages.push('Product SKU is required');
    }
    if (!context.code?.trim()) {
      messages.push('Product code is required');
    }
    return { isValid: messages.length === 0, messages };
  }
}
