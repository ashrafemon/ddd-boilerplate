import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AddPriceListLineUseCase } from '@business/product-management/product-pricing/application/use-cases/add-price-list-line.usecase';
import { RemovePriceListLineUseCase } from '@business/product-management/product-pricing/application/use-cases/remove-price-list-line.usecase';
import { GetProductPriceUseCase } from '@business/product-management/product-pricing/application/use-cases/get-product-price.usecase';
import { PriceListFactory } from '@business/product-management/product-pricing/domain/factories/price-list.factory';
import {
  InMemoryPriceListRepository,
  InMemoryPriceListPublisherPort,
  InMemoryPriceListQuery,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makePriceListContext,
} from '@test/support/product-pricing/price-list.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const baseInput = {
  name: 'List',
  code: 'LIST-1',
  currency: 'USD',
  effectiveFrom: new Date('2026-01-01'),
};

function makeRepo() {
  const repo = new InMemoryPriceListRepository();
  const list = PriceListFactory.create(baseInput);
  repo.store.set(list.id.toString(), list);
  return { repo, list };
}

describe('AddPriceListLineUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('adds a line to a price list', async () => {
    const { repo, list } = makeRepo();
    const publisher = new InMemoryPriceListPublisherPort();
    const useCase = new AddPriceListLineUseCase(
      repo,
      publisher,
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute({
      priceListId: list.id.toString(),
      productId: 'p1',
      price: 100,
      minQuantity: 1,
    });

    expect(id).toBe(list.id.toString());
    expect(repo.updates[0].lineItems).toHaveLength(1);
    expect(repo.updates[0].lineItems[0].price).toBe(100);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative price', async () => {
    const { repo, list } = makeRepo();
    const useCase = new AddPriceListLineUseCase(
      repo,
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    await expect(
      useCase.execute({
        priceListId: list.id.toString(),
        productId: 'p1',
        price: -1,
        minQuantity: 1,
      }),
    ).rejects.toThrow('Price list line price cannot be negative');
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const useCase = new AddPriceListLineUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );
    await expect(
      useCase.execute({ priceListId: 'missing', productId: 'p1', price: 1, minQuantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { list } = makeRepo();
    const useCase = new AddPriceListLineUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new DenyAbacAdapter(),
    );
    await expect(
      useCase.execute({
        priceListId: list.id.toString(),
        productId: 'p1',
        price: 1,
        minQuantity: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('RemovePriceListLineUseCase (integration)', () => {
  it('removes an existing line', async () => {
    const { repo, list } = makeRepo();
    list.addLine({ productId: 'p1', price: 100, minQuantity: 1 });

    const useCase = new RemovePriceListLineUseCase(
      repo,
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute({ priceListId: list.id.toString(), productId: 'p1' });
    expect(id).toBe(list.id.toString());
    expect(repo.updates[0].lineItems).toHaveLength(0);
  });

  it('rejects removing an unknown line', async () => {
    const { repo, list } = makeRepo();
    const useCase = new RemovePriceListLineUseCase(
      repo,
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    await expect(
      useCase.execute({ priceListId: list.id.toString(), productId: 'missing' }),
    ).rejects.toThrow('not found in price list');
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const useCase = new RemovePriceListLineUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );
    await expect(useCase.execute({ priceListId: 'missing', productId: 'p1' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('GetProductPriceUseCase (integration)', () => {
  it('returns the purchasable price for a product', async () => {
    const query = new InMemoryPriceListQuery();
    query.priceForProduct = { productId: 'p1', price: 100, currency: 'USD' } as never;

    const useCase = new GetProductPriceUseCase(query, makePriceListContext());
    const result = await useCase.execute({ productId: 'p1' });
    expect(result).not.toBeNull();
    expect((result as { price: number }).price).toBe(100);
  });

  it('throws NotFoundException when no active price exists', async () => {
    const useCase = new GetProductPriceUseCase(
      new InMemoryPriceListQuery(),
      makePriceListContext(),
    );
    await expect(useCase.execute({ productId: 'p1' })).rejects.toThrow(NotFoundException);
  });
});
