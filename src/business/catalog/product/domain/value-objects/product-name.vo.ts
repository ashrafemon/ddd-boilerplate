import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';

export class ProductName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): ProductName {
    return new ProductName(input.trim());
  }

  get value(): string {
    return this.props.value;
  }
}
