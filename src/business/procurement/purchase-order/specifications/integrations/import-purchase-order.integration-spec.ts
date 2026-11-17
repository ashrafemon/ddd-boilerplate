import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ImportPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/import-purchase-order.usecase';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryVendorQueryPort,
  InMemoryNumberingPort,
  InMemoryReadCachePort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makeVendorRef,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makeSut(opts?: {
  abacDeny?: boolean;
  noCompany?: boolean;
  vendorMissing?: boolean;
  existing?: boolean;
}) {
  const repo = new InMemoryPurchaseOrderRepository();
  const vendorPort = new InMemoryVendorQueryPort(
    new Map(opts?.vendorMissing ? [] : [['vendor-1', makeVendorRef()]]),
  );
  const numbering = new InMemoryNumberingPort();
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const readCache = new InMemoryReadCachePort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new ImportPurchaseOrderUseCase(
    repo,
    vendorPort,
    numbering,
    ctx,
    publisher,
    readCache,
    abac,
  );
  return { useCase, repo, publisher, readCache };
}

const input = {
  externalReference: 'REF-0001',
  vendorId: 'vendor-1',
  currency: 'USD',
  lines: [{ productId: 'p1', quantity: 5, unitPrice: 10 }],
};

describe('ImportPurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('creates a new draft purchase order from the import payload', async () => {
    const { useCase, repo, readCache } = makeSut();
    const id = await useCase.execute(input);

    expect(id).toBeTruthy();
    expect(repo.saves).toHaveLength(1);
    expect(repo.saves[0].status).toBe(PurchaseOrderStatus.DRAFT);
    expect(repo.saves[0].externalReference).toBe('REF-0001');
    expect(repo.saves[0].lines).toHaveLength(1);
    expect(repo.saves[0].lines[0].quantity).toBe(5);
    // command side invalidates the cache after a write
    expect(readCache.invalidated).toEqual([`purchase-order:${id}`]);
  });

  it('is idempotent — re-importing the same reference converges on the same PO', async () => {
    const { useCase, repo } = makeSut();
    const firstId = await useCase.execute(input);
    // seed the repository the way a second import would see it
    repo.findByExternalReference = async () => repo.store.get(firstId) ?? null;

    const secondId = await useCase.execute(input);
    expect(secondId).toBe(firstId);
  });

  it('rejects a different vendor for the same external reference', async () => {
    const { useCase, repo } = makeSut();
    const firstId = await useCase.execute(input);
    const existing = repo.store.get(firstId)!;
    repo.findByExternalReference = async () => existing;

    await expect(useCase.execute({ ...input, vendorId: 'vendor-2' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a currency mismatch for the same external reference', async () => {
    const { useCase, repo } = makeSut();
    const firstId = await useCase.execute(input);
    repo.findByExternalReference = async () => repo.store.get(firstId)!;

    await expect(useCase.execute({ ...input, currency: 'EUR' })).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when the vendor is not orderable', async () => {
    const { useCase } = makeSut({ vendorMissing: true });
    await expect(useCase.execute(input)).rejects.toThrow(ConflictException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute(input)).rejects.toThrow(ForbiddenException);
  });

  it('throws when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute(input)).rejects.toThrow('Company not found');
  });
});
