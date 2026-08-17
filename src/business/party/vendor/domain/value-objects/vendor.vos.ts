import { ValueObject } from '@business/shared-business/domain/bases';

export class VendorName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): VendorName {
    const normalized = input.trim();
    if (!normalized) {
      throw Object.assign(new Error('Vendor name cannot be empty'), { statusCode: 422 });
    }
    if (normalized.length > 200) {
      throw Object.assign(new Error('Vendor name cannot exceed 200 characters'), {
        statusCode: 422,
      });
    }
    return new VendorName(normalized);
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
    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('Vendor code cannot be empty'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(normalized)) {
      throw Object.assign(
        new Error('Vendor code must be 2-32 chars of letters, digits or dashes'),
        { statusCode: 422 },
      );
    }
    return new VendorCode(normalized);
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
    const normalized = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw Object.assign(new Error('Invalid vendor email'), { statusCode: 422 });
    }
    return new VendorEmail(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
