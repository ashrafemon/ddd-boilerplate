import { Injectable } from '@nestjs/common';
import { GetProductStockBalanceUseCase } from '../use-cases/get-product-stock-balance.usecase';
import { StockReadPort } from '@business/inventory/public/ports/stock-read.port';
import { StockReadReference } from '@business/inventory/public/contracts/stock-read.contract';

/**
 * Inventory module's stock read facade exposed to other modules.
 * Adapts the stock balance query to the stock read contract.
 */
@Injectable()
export class StockReadFacade extends StockReadPort {
  constructor(private readonly getProductStockBalanceUseCase: GetProductStockBalanceUseCase) {
    super();
  }

  async getStockBalance(
    productId: string,
    _companyId?: string,
  ): Promise<StockReadReference | null> {
    const balance = await this.getProductStockBalanceUseCase.execute(productId);
    if (!balance) return null;
    return {
      productId: balance.productId,
      companyId: _companyId ?? '',
      tenantId: null,
      quantity: balance.quantity,
      updatedAt: new Date(),
    };
  }
}
