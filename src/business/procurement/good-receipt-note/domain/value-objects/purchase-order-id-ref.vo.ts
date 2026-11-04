export class PurchaseOrderIdRef {
  constructor(public readonly value: string) {}

  toString(): string {
    return this.value;
  }

  equals(other?: PurchaseOrderIdRef): boolean {
    return !!other && this.value === other.value;
  }
}
