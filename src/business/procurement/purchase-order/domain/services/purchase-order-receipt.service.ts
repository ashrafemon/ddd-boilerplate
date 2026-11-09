export type PurchaseOrderReceiptStatus = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';

export class PurchaseOrderReceiptService {
  static deriveStatus(
    lines: readonly { quantity?: number; orderedQuantity?: number; receivedQuantity: number }[],
  ): PurchaseOrderReceiptStatus {
    if (lines.length === 0) return 'NOT_RECEIVED';
    const fullyReceived = lines.every(
      line => line.receivedQuantity >= (line.quantity ?? line.orderedQuantity ?? 0),
    );
    const anyReceived = lines.some(line => line.receivedQuantity > 0);
    if (fullyReceived) return 'FULLY_RECEIVED';
    if (anyReceived) return 'PARTIALLY_RECEIVED';
    return 'NOT_RECEIVED';
  }
}
