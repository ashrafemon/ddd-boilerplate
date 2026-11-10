export class SkuInvariants {
  static enforceSkuFormat(sku: string): void {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) {
      throw Object.assign(new Error('SKU cannot be empty'), { statusCode: 422 });
    }
    if (!/^[A-Z0-9-]{2,64}$/.test(normalized)) {
      throw Object.assign(new Error('SKU must be 2-64 chars of letters, digits or dashes'), {
        statusCode: 422,
      });
    }
  }
}
