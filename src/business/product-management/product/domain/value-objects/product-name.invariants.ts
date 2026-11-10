export class ProductNameInvariants {
  static enforceProductName(name: string): void {
    const normalized = name.trim();
    if (!normalized) {
      throw Object.assign(new Error('Product name cannot be empty'), { statusCode: 422 });
    }
    if (normalized.length > 200) {
      throw Object.assign(new Error('Product name cannot exceed 200 characters'), {
        statusCode: 422,
      });
    }
  }
}
