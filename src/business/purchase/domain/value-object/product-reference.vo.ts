import { ValueObject } from '../../../../shared-business/domain/value-object';

interface ProductReferenceProps {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
}

/**
 * Lightweight reference to a Product from the Product bounded context.
 */
export class ProductReference extends ValueObject<ProductReferenceProps> {
  private constructor(props: ProductReferenceProps) {
    super(props);
  }

  public static from(productId: string, sku: string, productName: string, unit: string): ProductReference {
    return new ProductReference({ productId, sku, productName, unit });
  }

  public getProductId(): string {
    return this.props.productId;
  }

  public getSku(): string {
    return this.props.sku;
  }

  public getProductName(): string {
    return this.props.productName;
  }
}
