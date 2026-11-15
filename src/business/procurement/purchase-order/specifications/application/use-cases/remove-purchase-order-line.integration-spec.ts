import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RemovePurchaseOrderLineUseCase } from '@business/procurement/purchase-order/application/use-cases/remove-purchase-order-line.usecase';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = makePurchaseOrderWithLines([
    { productId: 'p1', quantity: 5, unitPriceMinor: 500 },
    { productId: 'p2', quantity: 2, unitPriceMinor: 100 },
  ]);
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new RemovePurchaseOrderLineUseCase(repo, publisher, ctx, abac);
  return { useCase, repo, publisher, po };
}

describe('RemovePurchaseOrderLineUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('removes a draft line', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute({ id: po.id.toString(), productId: 'p1' });
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].lines.map(l => l.productId.toString())).toEqual(['p2']);
  });

  it('raises a line-removed event', async () => {
    const { useCase, publisher, po } = makeSut();
    await useCase.execute({ id: po.id.toString(), productId: 'p1' });
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing', productId: 'p1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(useCase.execute({ id: po.id.toString(), productId: 'p1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, po } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ id: po.id.toString(), productId: 'p1' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
