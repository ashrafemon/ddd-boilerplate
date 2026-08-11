import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface PhoneNumberProps {
  value: string;
}

/**
 * Phone number value object. E.164 is recommended; a loose sanity check is
 * applied so domestic formats remain usable in tests/demo data.
 */
export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): PhoneNumber {
    const normalized = value?.trim();
    if (!normalized || !/^[+0-9()\-. ]{6,20}$/.test(normalized)) {
      throw new DomainException(`Invalid phone number: ${String(value)}`, 'INVALID_PHONE');
    }
    return new PhoneNumber(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
