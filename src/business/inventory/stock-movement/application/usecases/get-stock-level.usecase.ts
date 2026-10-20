import { Injectable } from '@nestjs/common';
import { StockQuery } from '../queries/stock.query';

/**
 * Read the stock-balance projection for one product inside a company
 * (plan Phase 5.4 consumer support). Reads go through the module's query
 * port (replica-backed, tenant-scoped); a missing balance means "never
 * moved" → 0, and the tenant comes from the request context so one
 * company's stock never leaks into another tenant's view.
 */
@Injectable()
export class GetStockLevelUseCase {
  constructor(private readonly stockQueryRepo: StockQuery) {}

  async execute(productId: string, companyId: string): Promise<number> {
    const balance = await this.stockQueryRepo.findBalance(productId, companyId);
    return balance ?? 0;
  }
}
