import { NotFoundException } from '@nestjs/common';
import { AmendPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/amend-purchase-order.usecase';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryAuditPort,
  makeContext,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function issuedPo() {
  return makePurchaseOrderWithLines(
    [
      { productId: 'p1', quantity: 5, unitPriceMinor: 500 },
      { productId: 'p2', quantity: 2, unitPriceMinor: 100 },
    ],
    { status: PurchaseOrderStatus.ISSUED },
  );
}

function makeSut(opts?: { po?: ReturnType<typeof issuedPo> }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = opts?.po ?? issuedPo();
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const audit = new InMemoryAuditPort();
  const useCase = new AmendPurchaseOrderUseCase(repo, publisher, makeContext(), audit);
  return { useCase, repo, publisher, audit, po };
}

describe('AmendPurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('amends the expected delivery date of an ISSUED order', async () => {
    const { useCase, repo, po } = makeSut();
    const expectedDeliveryDate = new Date('2026-03-01');
    await useCase.execute({ id: po.id.toString(), expectedDeliveryDate, reason: 'vendor delay' });
    const amended = repo.updates[0];
    expect(amended.expectedDeliveryDate).toEqual(expectedDeliveryDate);
    expect(amended.amendedBy).toBe('user-1');
  });

  it('re-prices a line that has no receipt', async () => {
    const { useCase, repo, audit, po } = makeSut();
    await useCase.execute({
      id: po.id.toString(),
      lineUnitPrices: { p1: 7.5 },
      reason: 'price correction',
    });
    const line = repo.updates[0].lines.find(l => l.productId.toString() === 'p1');
    expect(line?.unitPrice.minorUnits).toBe(750);
    expect(line?.total.minorUnits).toBe(750 * 5);
    // the audit trail records the reason for the amendment
    expect(audit.entries[0].changes).toMatchObject({ reason: 'price correction' });
  });

  it('records an audit entry with the applied changes', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute({
      id: po.id.toString(),
      reason: 'reason',
      expectedDeliveryDate: new Date(),
    });
    expect(audit.entries[0].action).toBe('purchase-order.amend');
    expect(audit.entries[0].changes).toMatchObject({ reason: 'reason' });
  });

  it('rejects an amendment without a reason', async () => {
    const { useCase, po } = makeSut();
    await expect(
      useCase.execute({ id: po.id.toString(), reason: '   ', expectedDeliveryDate: new Date() }),
    ).rejects.toThrow('An amendment requires a reason');
  });

  it('rejects an amendment with no changes', async () => {
    const { useCase, po } = makeSut();
    await expect(useCase.execute({ id: po.id.toString(), reason: 'nothing' })).rejects.toThrow(
      'An amendment must change something',
    );
  });

  it('rejects re-pricing an unknown line', async () => {
    const { useCase, po } = makeSut();
    await expect(
      useCase.execute({ id: po.id.toString(), lineUnitPrices: { unknown: 100 }, reason: 'x' }),
    ).rejects.toThrow('Purchase order has no line for product unknown');
  });

  it('rejects amending a non-issued order', async () => {
    const draft = makePurchaseOrderWithLines([
      { productId: 'p1', quantity: 1, unitPriceMinor: 100 },
    ]);
    const { useCase } = makeSut({ po: draft });
    await expect(
      useCase.execute({ id: draft.id.toString(), reason: 'x', expectedDeliveryDate: new Date() }),
    ).rejects.toThrow('Only an issued purchase order can be amended');
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(
      useCase.execute({ id: 'missing', reason: 'x', expectedDeliveryDate: new Date() }),
    ).rejects.toThrow(NotFoundException);
  });
});
