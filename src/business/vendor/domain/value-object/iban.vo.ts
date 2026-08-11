import { DomainException } from '../../../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../../../../shared-business/domain/value-object';

interface IbanProps {
  value: string;
}

/**
 * International Bank Account Number. Structural sanity check only.
 */
export class Iban extends ValueObject<IbanProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): Iban {
    const normalized = value?.trim().replace(/\s+/g, '').toUpperCase();
    if (!normalized || !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) {
      throw new DomainException(`Invalid IBAN: ${String(value)}`, 'INVALID_IBAN');
    }
    return new Iban(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
