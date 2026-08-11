import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

export enum ProductStatusValue {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

interface ProductStatusProps {
  value: ProductStatusValue;
}

/**
 * Lifecycle status of a Product.
 */
export class ProductStatus extends ValueObject<ProductStatusProps> {
  private constructor(value: ProductStatusValue) {
    super({ value });
  }

  public static from(value: string): ProductStatus {
    if (!Object.values(ProductStatusValue).includes(value as ProductStatusValue)) {
      throw new DomainException(`Invalid product status: ${String(value)}`, 'INVALID_PRODUCT_STATUS');
    }
    return new ProductStatus(value as ProductStatusValue);
  }

  public static active(): ProductStatus {
    return new ProductStatus(ProductStatusValue.ACTIVE);
  }

  public static inactive(): ProductStatus {
    return new ProductStatus(ProductStatusValue.INACTIVE);
  }

  public getValue(): ProductStatusValue {
    return this.props.value;
  }

  public canTransitionTo(target: ProductStatusValue): boolean {
    const allowed: Record<ProductStatusValue, ProductStatusValue[]> = {
      [ProductStatusValue.ACTIVE]: [ProductStatusValue.INACTIVE],
      [ProductStatusValue.INACTIVE]: [ProductStatusValue.ACTIVE],
    };
    return (allowed[this.props.value] ?? []).includes(target);
  }

  public isActive(): boolean {
    return this.props.value === ProductStatusValue.ACTIVE;
  }
}
