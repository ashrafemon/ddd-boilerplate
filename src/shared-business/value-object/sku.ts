import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface SkuProps {
  value: string;
}

/**
 * Stock-keeping unit code.
 */
export class Sku extends ValueObject<SkuProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): Sku {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9._-]{2,64}$/.test(normalized)) {
      throw new DomainException(`Invalid SKU: ${String(value)}`, 'INVALID_SKU');
    }
    return new Sku(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
