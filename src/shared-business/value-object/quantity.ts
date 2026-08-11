import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface QuantityProps {
  value: number;
}

/**
 * Immutable quantity value object.
 *
 * NOTE: JavaScript numbers are used for the boilerplate. Production systems
 * that need exact decimal arithmetic should back this value object with a
 * decimal library or a BigInt-based representation.
 */
export class Quantity extends ValueObject<QuantityProps> {
  private constructor(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new DomainException(`Quantity must be a positive finite number, got ${String(value)}`, 'INVALID_QUANTITY');
    }
    super({ value });
  }

  public static from(value: number): Quantity {
    return new Quantity(value);
  }

  public static one(): Quantity {
    return new Quantity(1);
  }

  public getValue(): number {
    return this.props.value;
  }

  public add(other: Quantity): Quantity {
    return new Quantity(this.props.value + other.props.value);
  }

  public subtract(other: Quantity): Quantity {
    return new Quantity(this.props.value - other.props.value);
  }
}
