export class ProductIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: ProductIdRef): boolean {
    return !!other && this.value === other.value;
  }
}
