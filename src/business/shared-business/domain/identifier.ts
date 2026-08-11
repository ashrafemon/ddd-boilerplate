import { randomUUID } from 'crypto';

/**
 * Typed identifier base. Keeps aggregate ids strongly typed so a ProductId
 * cannot accidentally be passed where a VendorId is expected.
 */
export abstract class Identifier<T extends string = string> {
  protected constructor(public readonly value: T) {}

  toString(): string {
    return this.value;
  }

  equals(other?: Identifier<T>): boolean {
    return !!other && this.value === other.value;
  }

  static create(value?: string): string {
    return value && value.trim().length > 0 ? value : randomUUID();
  }
}
