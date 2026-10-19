export abstract class StockQueryPort {
  abstract getStockLevel(productId: string, companyId: string): Promise<number>;
}
