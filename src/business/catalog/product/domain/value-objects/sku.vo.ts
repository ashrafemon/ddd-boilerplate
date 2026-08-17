import { ValueObject } from '@business/shared-business/domain/bases';

export class Sku extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): Sku {
    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('SKU cannot be empty'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,64}$/.test(normalized)) {
      throw Object.assign(new Error('SKU must be 2-64 chars of letters, digits or dashes'), {
        statusCode: 422,
      });
    }
    return new Sku(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
