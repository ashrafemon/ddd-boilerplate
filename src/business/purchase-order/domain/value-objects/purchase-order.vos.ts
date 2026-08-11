import { ValidationError } from '@business/shared-business/domain/domain.error';
import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { Identifier } from '@business/shared-business/domain/identifier';

export class OrderNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): OrderNumber {
    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      throw new ValidationError('Order number cannot be empty');
    }
    return new OrderNumber(normalized);
  }

  static generate(sequence: number): OrderNumber {
    return new OrderNumber(`PO-${String(sequence).padStart(8, '0')}`);
  }

  get value(): string {
    return this.props.value;
  }
}

export class VendorIdRef extends Identifier {
  constructor(value: string) {
    super(value);
  }
}

export class ProductIdRef extends Identifier {
  constructor(value: string) {
    super(value);
  }
}
