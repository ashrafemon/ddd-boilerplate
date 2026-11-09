export class PriceListCode {
  private constructor(public readonly value: string) {}

  static create(value: string): PriceListCode {
    if (!value || value.trim().length === 0) {
      throw Object.assign(new Error('Price list code is required'), { statusCode: 422 });
    }
    return new PriceListCode(value.trim().toUpperCase());
  }

  toString(): string {
    return this.value;
  }

  equals(other?: PriceListCode): boolean {
    return !!other && this.value === other.value;
  }
}
