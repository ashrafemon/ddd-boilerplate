import { Injectable } from '@nestjs/common';
import { StockQueryPort } from '../../public';
import { GetStockLevelUseCase } from '../usecases/get-stock-level.usecase';

/**
 * Inventory's query facade exposed to other bounded contexts (sales,
 * accounting — plan Phase 5.4). Lives in the stock-movement module because it
 * adapts the module's own use case to the consumer-facing contract in
 * `public/`; consumers bind nothing themselves — they import this module and
 * inject `StockQueryPort`.
 */
@Injectable()
export class StockQueryFacade extends StockQueryPort {
  constructor(private readonly getStockLevelUseCase: GetStockLevelUseCase) {
    super();
  }

  getStockLevel(productId: string, companyId: string): Promise<number> {
    return this.getStockLevelUseCase.execute(productId, companyId);
  }
}
