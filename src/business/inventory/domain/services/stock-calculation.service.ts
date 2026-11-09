export class StockCalculationService {
  static add(quantity: number, delta: number): number {
    const result = quantity + delta;
    if (result < 0) {
      throw Object.assign(new Error('Stock balance cannot go negative'), {
        statusCode: 422,
      });
    }
    return result;
  }
}
