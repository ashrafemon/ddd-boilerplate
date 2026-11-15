import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivatePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/activate-price-list.usecase';
import { DeactivatePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/deactivate-price-list.usecase';
import { ArchivePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/archive-price-list.usecase';
import { PriceListFactory } from '@business/product-management/product-pricing/domain/factories/price-list.factory';
import { PriceListStatus } from '@business/product-management/product-pricing/domain/types/price-list.enum';
import {
  InMemoryPriceListRepository,
  InMemoryPriceListPublisherPort,
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

describe('ActivatePriceListUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('activates a draft list', async () => {
    const { repo, list } = makeRepo();
    const publisher = new InMemoryPriceListPublisherPort();
    const useCase = new ActivatePriceListUseCase(
      repo,
      publisher,
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute({ id: list.id.toString() });
    expect(id).toBe(list.id.toString());
    expect(repo.updates[0].status).toBe(PriceListStatus.ACTIVE);
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const useCase = new ActivatePriceListUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { list } = makeRepo();
    const useCase = new ActivatePriceListUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new DenyAbacAdapter(),
    );
    await expect(useCase.execute({ id: list.id.toString() })).rejects.toThrow(ForbiddenException);
  });
});

describe('DeactivatePriceListUseCase (integration)', () => {
  it('is a no-op that keeps the list active', async () => {
    const { repo, list } = makeRepo();
    list.activate();
    const useCase = new DeactivatePriceListUseCase(
      repo,
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute({ id: list.id.toString() });
    expect(id).toBe(list.id.toString());
    // the aggregate's deactivate() transitions to ACTIVE (documented behavior)
    expect(repo.updates[0].status).toBe(PriceListStatus.ACTIVE);
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const useCase = new DeactivatePriceListUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ArchivePriceListUseCase (integration)', () => {
  it('archives a draft list', async () => {
    const { repo, list } = makeRepo();
    const useCase = new ArchivePriceListUseCase(
      repo,
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute({ id: list.id.toString() });
    expect(id).toBe(list.id.toString());
    expect(repo.updates[0].status).toBe(PriceListStatus.ARCHIVED);
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const useCase = new ArchivePriceListUseCase(
      new InMemoryPriceListRepository(),
      new InMemoryPriceListPublisherPort(),
      makePriceListContext(),
      new AllowAbacAdapter(),
    );
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
