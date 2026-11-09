import { StockReadReference } from '../contracts/stock-read.contract';

export abstract class StockReadPort {
  abstract getStockBalance(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<StockReadReference | null>;
}
