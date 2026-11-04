export class VendorIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: VendorIdRef): boolean {
    return !!other && this.value === other.value;
  }
}
