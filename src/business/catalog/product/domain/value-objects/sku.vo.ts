import { ValueObject } from '@business/shared-business/domain/bases';

export class Sku extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): Sku {
    return new Sku(input.trim().toUpperCase());
  }

  get value(): string {
    return this.props.value;
  }
}
