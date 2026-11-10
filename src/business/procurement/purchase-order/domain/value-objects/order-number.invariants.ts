export class OrderNumberInvariants {
  static enforceOrderNumberCreate(orderNumber: string): void {
    if (!orderNumber?.trim()) {
      throw Object.assign(new Error('Order number is required'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(orderNumber.trim())) {
      throw Object.assign(new Error('Order number must match PO-<identifier>'), {
        statusCode: 422,
      });
    }
  }
}
