export type PurchaseOrderReceiptStatus = 'NONE' | 'PARTIAL' | 'FULL';

export class PurchaseOrderStatusService {
  static deriveReceiptStatus(
    lines: readonly { quantity: number; receivedQuantity: number }[],
  ): PurchaseOrderReceiptStatus {
    if (lines.length === 0) return 'NONE';
    const fullyReceived = lines.every(line => line.receivedQuantity >= line.quantity);
    const anyReceived = lines.some(line => line.receivedQuantity > 0);
    if (fullyReceived) return 'FULL';
    if (anyReceived) return 'PARTIAL';
    return 'NONE';
  }
}
