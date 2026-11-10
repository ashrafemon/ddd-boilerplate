import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';
import { GrnNumberInvariants } from './grn-number.invariants';
import './grn-number.invariants';

export class GrnNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): GrnNumber {
    GrnNumberInvariants.enforceGrnNumberFormat(input);
    return new GrnNumber(input.trim().toUpperCase());
  }

  get value(): string {
    return this.props.value;
  }
}
