import { StockBalanceReference } from '../contracts/stock-movement-reference.contract';

export abstract class StockBalancePort {
  abstract findBalance(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<StockBalanceReference | null>;
}
