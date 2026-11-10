import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';

import { OrderNumberInvariants } from './order-number.invariants';

export class OrderNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): OrderNumber {
    OrderNumberInvariants.enforceOrderNumberCreate(input);
    return new OrderNumber(input.trim().toUpperCase());
  }

  static generate(sequence: number): OrderNumber {
    return new OrderNumber(`PO-${String(sequence).padStart(8, '0')}`);
  }

  get value(): string {
    return this.props.value;
  }
}
