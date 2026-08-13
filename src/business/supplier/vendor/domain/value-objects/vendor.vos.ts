import { ValidationError } from '@business/shared-business/domain/domain.error';
import { ValueObject } from '@business/shared-business/domain/bases';

export class VendorName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): VendorName {
    const normalized = input.trim();
    if (!normalized) {
      throw new ValidationError('Vendor name cannot be empty');
    }
    if (normalized.length > 200) {
      throw new ValidationError('Vendor name cannot exceed 200 characters');
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
      throw new ValidationError('Vendor code cannot be empty');
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(normalized)) {
      throw new ValidationError('Vendor code must be 2-32 chars of letters, digits or dashes');
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
      throw new ValidationError('Invalid vendor email');
    }
    return new VendorEmail(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
