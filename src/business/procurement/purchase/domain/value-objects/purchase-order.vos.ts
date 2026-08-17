import { ValueObject } from '@business/shared-business/domain/bases';

export class OrderNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(input: string): OrderNumber {
    const normalized = input.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('Order number cannot be empty'), { statusCode: 422 });
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

export class VendorIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: VendorIdRef): boolean {
    return !!other && this.value === other.value;
  }
}

export class ProductIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: ProductIdRef): boolean {
    return !!other && this.value === other.value;
  }
}
