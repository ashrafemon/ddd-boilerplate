import { ValueObject } from '@business/shared-business/domain/bases';

export class VendorName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): VendorName {
    return new VendorName(input.trim());
  }

  get value(): string {
    return this.props.value;
  }
}

export class VendorCode extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): VendorCode {
    return new VendorCode(input.trim().toUpperCase());
  }

  get value(): string {
    return this.props.value;
  }
}

export class VendorEmail extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): VendorEmail {
    return new VendorEmail(input.trim().toLowerCase());
  }

  get value(): string {
    return this.props.value;
  }
}
