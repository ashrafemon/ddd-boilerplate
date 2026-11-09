import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import './grn-number.invariants';

export class GrnNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): GrnNumber {
    invariantRegistry.enforce('grn-number.create', { grnNumber: input });
    return new GrnNumber(input.trim().toUpperCase());
  }

  get value(): string {
    return this.props.value;
  }
}
