import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface PercentageProps {
  value: number;
}

/**
 * Percentage value object. 100 represents 100%, 12.5 represents 12.5%.
 */
export class Percentage extends ValueObject<PercentageProps> {
  private constructor(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new DomainException(`Percentage must be between 0 and 100, got ${String(value)}`, 'INVALID_PERCENTAGE');
    }
    super({ value });
  }

  public static from(value: number): Percentage {
    return new Percentage(value);
  }

  public getValue(): number {
    return this.props.value;
  }

  public asFraction(): number {
    return this.props.value / 100;
  }
}
