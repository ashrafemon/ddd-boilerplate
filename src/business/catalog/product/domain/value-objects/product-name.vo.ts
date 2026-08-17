import { ValueObject } from '@business/shared-business/domain/bases';

export class ProductName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): ProductName {
    const normalized = input.trim();
    if (!normalized) {
      throw Object.assign(new Error('Product name cannot be empty'), { statusCode: 422 });
    }
    if (normalized.length > 200) {
      throw Object.assign(new Error('Product name cannot exceed 200 characters'), {
        statusCode: 422,
      });
    }
    return new ProductName(normalized);
  }

  get value(): string {
    return this.props.value;
  }
}
