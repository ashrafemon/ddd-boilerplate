import { DomainException } from '../../shared-kernel/exceptions/domain.exception';
import { ValueObject } from '../domain/value-object';

export type AddressType = 'BILLING' | 'SHIPPING' | 'REGISTERED';

interface AddressProps {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

/**
 * Postal address value object.
 */
export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  public static from(props: AddressProps): Address {
    if (!props?.line1?.trim() || !props?.city?.trim() || !props?.country?.trim()) {
      throw new DomainException('Address requires line1, city and country', 'INVALID_ADDRESS');
    }
    return new Address(props);
  }

  public getLine1(): string {
    return this.props.line1;
  }

  public getCity(): string {
    return this.props.city;
  }

  public getCountry(): string {
    return this.props.country;
  }
}
