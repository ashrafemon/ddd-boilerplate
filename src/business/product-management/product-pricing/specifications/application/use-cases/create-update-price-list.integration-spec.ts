import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/create-price-list.usecase';
import { UpdatePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/update-price-list.usecase';
import { PriceListFactory } from '@business/product-management/product-pricing/domain/factories/price-list.factory';
import {
  InMemoryPriceListRepository,
  InMemoryPriceListPublisherPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makePriceListContext,
} from '@test/support/product-pricing/price-list.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

// factory input (Date) vs use-case request (ISO string)
const factoryInput = {
  name: 'List',
  code: 'LIST-1',
  currency: 'USD',
  effectiveFrom: new Date('2026-01-01'),
};

const requestInput = {
  name: 'List',
  code: 'LIST-1',
  currency: 'USD',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

describe('CreatePriceListUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  function makeSut(opts?: {
    existing?: ReturnType<typeof PriceListFactory.create>;
    abacDeny?: boolean;
    noCompany?: boolean;
  }) {
    const repo = new InMemoryPriceListRepository();
    if (opts?.existing) repo.store.set(opts.existing.id.toString(), opts.existing);
    const publisher = new InMemoryPriceListPublisherPort();
    const ctx = makePriceListContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new CreatePriceListUseCase(repo, publisher, ctx, abac);
    return { useCase, repo, publisher, ctx };
  }

  it('creates a price list', async () => {
    const { useCase, repo, publisher } = makeSut();
    const id = await useCase.execute(requestInput);
    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].code).toBe('LIST-1');
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws ConflictException when the code already exists', async () => {
    const existing = PriceListFactory.create(factoryInput);
    const { useCase } = makeSut({ existing });
    await expect(useCase.execute(requestInput)).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(requestInput)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute(requestInput)).rejects.toThrow(ForbiddenException);
  });
});

describe('UpdatePriceListUseCase (integration)', () => {
  function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
    const repo = new InMemoryPriceListRepository();
    const list = PriceListFactory.create(factoryInput);
    repo.store.set(list.id.toString(), list);
    const publisher = new InMemoryPriceListPublisherPort();
    const ctx = makePriceListContext(opts?.noCompany ? { companyId: undefined } : undefined);
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new UpdatePriceListUseCase(repo, publisher, ctx, abac);
    return { useCase, repo, publisher, list };
  }

  it('updates the price list header', async () => {
    const { useCase, repo, list } = makeSut();
    const id = await useCase.execute({ id: list.id.toString(), name: 'New Name' });
    expect(id).toBe(list.id.toString());
    expect(repo.updates[0].name).toBe('New Name');
  });

  it('throws NotFoundException when the list does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing', name: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, list } = makeSut({ noCompany: true });
    await expect(useCase.execute({ id: list.id.toString(), name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, list } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ id: list.id.toString(), name: 'X' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
