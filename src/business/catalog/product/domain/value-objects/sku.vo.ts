import { ValidationError } from '@business/shared-business/domain/domain.error';
import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';

export class Sku extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): Sku {
    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      throw new ValidationError('SKU cannot be empty');
    }
    if (!/^[A-Z0-9-]{2,64}$/.test(normalized)) {
      throw new ValidationError('SKU must be 2-64 chars of letters, digits or dashes');
    }
    return new Sku(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
