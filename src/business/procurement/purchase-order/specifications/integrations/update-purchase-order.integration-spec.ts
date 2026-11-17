import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdatePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/update-purchase-order.usecase';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makePo() {
  return makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }]);
}

function makeSut(opts?: { po?: ReturnType<typeof makePo> }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = opts?.po ?? makePo();
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const useCase = new UpdatePurchaseOrderUseCase(repo, publisher);
  return { useCase, repo, publisher, po };
}

describe('UpdatePurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('updates the draft header', async () => {
    const { useCase, repo, po } = makeSut();
    const orderDate = new Date('2026-01-15');
    const id = await useCase.execute({ id: po.id.toString(), orderDate });
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].orderDate).toEqual(orderDate);
  });

  it('updates externalReference when free', async () => {
    const { useCase, repo, po } = makeSut();
    await useCase.execute({ id: po.id.toString(), externalReference: 'REF-1' });
    expect(repo.updates[0].externalReference).toBe('REF-1');
  });

  it('throws ConflictException when externalReference collides', async () => {
    const { useCase, po } = makeSut();
    // pre-existing row that will collide
    const repoWithCollision = { findByExternalReference: async () => ({ id: 'other' }) };
    const useCaseWithCollision = new UpdatePurchaseOrderUseCase(
      {
        findById: async () => po,
        findByExternalReference: repoWithCollision.findByExternalReference,
        save: async (x: unknown) => x,
        update: async (x: unknown) => x,
        findByOrderNumber: async () => null,
      } as never,
      new InMemoryPurchaseOrderPublisherPort(),
    );
    await expect(
      useCaseWithCollision.execute({ id: po.id.toString(), externalReference: 'REF-DUP' }),
    ).rejects.toThrow(ConflictException);
    expect(useCase).toBeDefined();
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('rejects a non-draft order via the aggregate invariant', async () => {
    const issued = makePurchaseOrderWithLines(
      [{ productId: 'p1', quantity: 1, unitPriceMinor: 100 }],
      {
        status: PurchaseOrderStatus.ISSUED,
      },
    );
    const { useCase } = makeSut({ po: issued });
    await expect(
      useCase.execute({ id: issued.id.toString(), orderDate: new Date() }),
    ).rejects.toThrow(/only DRAFT orders are editable/);
  });
});
