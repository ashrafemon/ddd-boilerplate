import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface CurrencyProps {
  code: string;
}

/**
 * ISO 4217 currency code.
 */
export class Currency extends ValueObject<CurrencyProps> {
  private constructor(code: string) {
    super({ code });
  }

  public static from(code: string): Currency {
    const normalized = code?.trim().toUpperCase();
    if (!normalized || !/^[A-Z]{3}$/.test(normalized)) {
      throw new DomainException(`Invalid ISO 4217 currency code: ${String(code)}`, 'INVALID_CURRENCY');
    }
    return new Currency(normalized);
  }

  public static USD(): Currency {
    return new Currency('USD');
  }

  public static EUR(): Currency {
    return new Currency('EUR');
  }

  public getCode(): string {
    return this.props.code;
  }
}
