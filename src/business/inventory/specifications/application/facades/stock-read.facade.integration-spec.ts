import { StockReadFacade } from '@business/inventory/application/facades/stock-read.facade';
import { GetProductStockBalanceUseCase } from '@business/inventory/application/use-cases/get-product-stock-balance.usecase';
import { StockMovementQuery } from '@business/inventory/application/queries/stock-movement.query';
import { StockMovementQueryRecord } from '@business/inventory/domain/types/stock-movement.types';
import { makeInventoryContext } from '@test/support/inventory/inventory.fakes';
import { PageResult } from '@common/application/types/pagination';

class InMemoryStockMovementQuery extends StockMovementQuery {
  constructor(private readonly balance: { productId: string; quantity: number } | null) {
    super();
  }
  async findById(): Promise<StockMovementQueryRecord | null> {
    return null;
  }
  async findByProduct(): Promise<PageResult<StockMovementQueryRecord>> {
    return { items: [], page: 1, pageSize: 0, total: 0, totalPages: 0 };
  }
  async findBalance(): Promise<{ productId: string; quantity: number } | null> {
    return this.balance;
  }
}

describe('StockReadFacade (integration)', () => {
  it('maps a balance to the stock read contract', async () => {
    const query = new InMemoryStockMovementQuery({ productId: 'p1', quantity: 42 });
    const facade = new StockReadFacade(
      new GetProductStockBalanceUseCase(query, makeInventoryContext()),
    );

    const result = await facade.getStockBalance('p1', 'company-1');
    expect(result).toMatchObject({ productId: 'p1', companyId: 'company-1', quantity: 42 });
  });

  it('returns null when there is no balance', async () => {
    const facade = new StockReadFacade(
      new GetProductStockBalanceUseCase(
        new InMemoryStockMovementQuery(null),
        makeInventoryContext(),
      ),
    );
    await expect(facade.getStockBalance('p1')).resolves.toBeNull();
  });
});
