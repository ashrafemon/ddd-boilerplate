export class OpenQuantityService {
  static openQuantity(orderedQuantity: number, receivedQuantity: number): number {
    return Math.max(0, orderedQuantity - receivedQuantity);
  }

  static maxReceivableQuantity(
    orderedQuantity: number,
    receivedQuantity: number,
    tolerance: number,
  ): number {
    return orderedQuantity * (1 + tolerance) - receivedQuantity;
  }
}
