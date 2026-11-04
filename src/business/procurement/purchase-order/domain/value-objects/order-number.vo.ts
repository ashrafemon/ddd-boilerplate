import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import './order-number.invariants';

export class OrderNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): OrderNumber {
    invariantRegistry.enforce('order-number.create', { orderNumber: input });
    return new OrderNumber(input.trim().toUpperCase());
  }

  static generate(sequence: number): OrderNumber {
    return new OrderNumber(`PO-${String(sequence).padStart(8, '0')}`);
  }

  get value(): string {
    return this.props.value;
  }
}
