export class ReceivedQuantityInvariants {
  static enforceReceivedQuantityPositive(receivedQuantity: number): void {
    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      throw Object.assign(new Error('Received quantity must be positive'), { statusCode: 422 });
    }
  }
}
