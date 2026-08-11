import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

interface EmailAddressProps {
  value: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email address value object. Always normalized to lowercase.
 */
export class EmailAddress extends ValueObject<EmailAddressProps> {
  private constructor(value: string) {
    super({ value });
  }

  public static from(value: string): EmailAddress {
    const normalized = value?.trim().toLowerCase();
    if (!normalized || !EMAIL_REGEX.test(normalized)) {
      throw new DomainException(`Invalid email address: ${String(value)}`, 'INVALID_EMAIL');
    }
    return new EmailAddress(normalized);
  }

  public getValue(): string {
    return this.props.value;
  }
}
