import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-purchase.contract';
import { AddPurchaseOrderLineUseCase } from '@business/procurement/purchase-order/application/use-cases/add-purchase-order-line.usecase';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryProductQueryPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makeProductRef,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

const PRODUCT_ID = 'product-1';

function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean; productMissing?: boolean }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = makePurchaseOrderWithLines([
    { productId: 'existing', quantity: 1, unitPriceMinor: 100 },
  ]);
  repo.store.set(po.id.toString(), po);

  const products = new Map<string, ProductReference>();
  if (!opts?.productMissing) products.set(PRODUCT_ID, makeProductRef());

  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new AddPurchaseOrderLineUseCase(
    repo,
    new InMemoryProductQueryPort(products),
    publisher,
    ctx,
    abac,
  );
  return { useCase, repo, publisher, po };
}

describe('AddPurchaseOrderLineUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('adds a line to a draft purchase order', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 3,
      unitPrice: 10,
    });
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].lines).toHaveLength(2);
  });

  it('snapshots the product name onto the line', async () => {
    const { useCase, repo, po } = makeSut();
    await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 1,
      unitPrice: 10,
    });
    const line = repo.updates[0].lines.find(l => l.productId.toString() === PRODUCT_ID);
    expect(line?.descriptionSnapshot).toBe('Wireless Mouse');
  });

  it('accumulates quantity when the product is already on the order', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = makePurchaseOrderWithLines([
      { productId: PRODUCT_ID, quantity: 2, unitPriceMinor: 1000 },
    ]);
    repo.store.set(po.id.toString(), po);
    const useCase = new AddPurchaseOrderLineUseCase(
      repo,
      new InMemoryProductQueryPort(new Map([[PRODUCT_ID, makeProductRef()]])),
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new AllowAbacAdapter(),
    );

    await useCase.execute({
      id: po.id.toString(),
      productId: PRODUCT_ID,
      quantity: 3,
      unitPrice: 10,
    });
    const line = repo.updates[0].lines.find(l => l.productId.toString() === PRODUCT_ID);
    expect(line?.quantity).toBe(5);
  });

  it('throws ConflictException when the product is not purchasable', async () => {
    const { useCase, po } = makeSut({ productMissing: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(
      useCase.execute({ id: 'missing', productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, po } = makeSut({ abacDeny: true });
    await expect(
      useCase.execute({ id: po.id.toString(), productId: PRODUCT_ID, quantity: 1, unitPrice: 10 }),
    ).rejects.toThrow(ForbiddenException);
  });
});
