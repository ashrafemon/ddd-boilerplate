import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

interface TaxIdentifierProps {
  value: string;
}

/**
 * Tax identifier (VAT ID / EIN etc.). A light validation is applied so
 * local/demo values remain usable while obvious garbage is rejected.
 */
export class TaxIdentifier extends ValueObject<TaxIdentifierProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): TaxIdentifier {
    const normalized = value?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9-]{4,32}$/.test(normalized)) {
      throw new DomainException(`Invalid tax identifier: ${String(value)}`, 'INVALID_TAX_IDENTIFIER');
    }
    return new TaxIdentifier(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
