export class GrnLineInvariants {
  static enforceGrnLineQuantity(receivedQuantity: number): void {
    if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) {
      throw Object.assign(new Error('GRN line quantity must be positive'), {
        statusCode: 422,
      });
    }
  }
}
