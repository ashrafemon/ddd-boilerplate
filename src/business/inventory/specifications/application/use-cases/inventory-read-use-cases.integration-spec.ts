import { GetProductStockBalanceUseCase } from '@business/inventory/application/use-cases/get-product-stock-balance.usecase';
import { ListStockMovementsUseCase } from '@business/inventory/application/use-cases/list-stock-movements.usecase';
import {
  InMemoryStockMovementQuery,
  makeInventoryContext,
  makeStockMovementQueryRecord,
} from '@test/support/inventory/inventory.fakes';

describe('GetProductStockBalanceUseCase (integration)', () => {
  it('returns the balance for a product', async () => {
    const query = new InMemoryStockMovementQuery();
    query.balance = { productId: 'p1', quantity: 42 };

    const useCase = new GetProductStockBalanceUseCase(query, makeInventoryContext());
    await expect(useCase.execute('p1')).resolves.toEqual({ productId: 'p1', quantity: 42 });
  });

  it('returns null when no balance exists', async () => {
    const useCase = new GetProductStockBalanceUseCase(
      new InMemoryStockMovementQuery(),
      makeInventoryContext(),
    );
    await expect(useCase.execute('p1')).resolves.toBeNull();
  });
});

describe('ListStockMovementsUseCase (integration)', () => {
  it('returns a page of movements', async () => {
    const query = new InMemoryStockMovementQuery();
    query.byId.set('sm-1', makeStockMovementQueryRecord());
    query.byId.set('sm-2', makeStockMovementQueryRecord({ id: 'sm-2' }));

    const useCase = new ListStockMovementsUseCase(query, makeInventoryContext());
    const result = await useCase.execute('p1', { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it('returns an empty page when there are no movements', async () => {
    const useCase = new ListStockMovementsUseCase(
      new InMemoryStockMovementQuery(),
      makeInventoryContext(),
    );
    const result = await useCase.execute('p1');
    expect(result.items).toHaveLength(0);
  });
});
