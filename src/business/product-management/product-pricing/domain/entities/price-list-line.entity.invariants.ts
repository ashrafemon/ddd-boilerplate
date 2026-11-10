export class PriceListLineInvariants {
  static enforcePriceListLineCreatePrice(price: number): void {
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Price list line price cannot be negative'), {
        statusCode: 422,
      });
    }
  }

  static enforcePriceListLineCreateQuantityRange(
    minQuantity: number,
    maxQuantity: number | null,
  ): void {
    if (!Number.isFinite(minQuantity) || minQuantity < 1) {
      throw Object.assign(new Error('Price list line minimum quantity must be >= 1'), {
        statusCode: 422,
      });
    }
    if (maxQuantity !== null && maxQuantity < minQuantity) {
      throw Object.assign(
        new Error('Price list line maximum quantity must be >= minimum quantity'),
        { statusCode: 422 },
      );
    }
  }
}
