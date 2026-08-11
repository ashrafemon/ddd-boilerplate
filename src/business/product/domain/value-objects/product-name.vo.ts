import { ValidationError } from '@business/shared-business/domain/domain.error';
import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';

export class ProductName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): ProductName {
    const normalized = input.trim();
    if (!normalized) {
      throw new ValidationError('Product name cannot be empty');
    }
    if (normalized.length > 200) {
      throw new ValidationError('Product name cannot exceed 200 characters');
    }
    return new ProductName(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
