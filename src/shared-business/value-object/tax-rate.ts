import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface TaxRateProps {
  basisPoints: number;
}

/**
 * Tax rate expressed in basis points (1 bp = 0.01%). 2500 bps = 25%.
 */
export class TaxRate extends ValueObject<TaxRateProps> {
  private constructor(basisPoints: number) {
    if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) {
      throw new DomainException(
        `Tax rate must be between 0 and 10000 basis points, got ${String(basisPoints)}`,
        'INVALID_TAX_RATE',
      );
    }
    super({ basisPoints });
  }

  public static fromBasisPoints(basisPoints: number): TaxRate {
    return new TaxRate(basisPoints);
  }

  public static fromPercentage(percentage: number): TaxRate {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new DomainException(`Invalid tax percentage: ${String(percentage)}`, 'INVALID_TAX_RATE');
    }
    return new TaxRate(Math.round(percentage * 100));
  }

  public static zero(): TaxRate {
    return new TaxRate(0);
  }

  public getBasisPoints(): number {
    return this.props.basisPoints;
  }

  public getPercentage(): number {
    return this.props.basisPoints / 100;
  }
}
