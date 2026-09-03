import { ValueObject } from '@business/shared-business/domain/bases/value-object.base';

export class GrnId {
  private constructor(public readonly value: string) {}

  static fromString(value: string): GrnId {
    return new GrnId(value);
  }

  static generate(): GrnId {
    return new GrnId(`GRN-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  }

  toString(): string {
    return this.value;
  }

  equals(other?: GrnId): boolean {
    return !!other && this.value === other.value;
  }
}

export class GrnNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): GrnNumber {
    return new GrnNumber(input.trim().toUpperCase());
  }

  get value(): string {
    return this.props.value;
  }
}

export class ReceivedQuantity {
  private constructor(public readonly value: number) {}

  static create(value: number): ReceivedQuantity {
    if (value <= 0) {
      throw new Error('Received quantity must be greater than zero');
    }
    return new ReceivedQuantity(value);
  }

  equals(other?: ReceivedQuantity): boolean {
    return !!other && this.value === other.value;
  }
}

export class PurchaseOrderIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: PurchaseOrderIdRef): boolean {
    return !!other && this.value === other.value;
  }
}