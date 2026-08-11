import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

interface ProductUnitProps {
  value: string;
}

/**
 * Unit of measure for a product (EA, KG, L, BOX, ...).
 */
export class ProductUnit extends ValueObject<ProductUnitProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): ProductUnit {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9]{1,8}$/.test(normalized)) {
      throw new DomainException(`Invalid product unit: ${String(value)}`, 'INVALID_PRODUCT_UNIT');
    }
    return new ProductUnit(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
