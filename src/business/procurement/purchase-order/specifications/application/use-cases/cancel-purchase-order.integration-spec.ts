import { NotFoundException } from '@nestjs/common';
import { CancelPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/cancel-purchase-order.usecase';
import { PurchaseOrderFactory } from '@business/procurement/purchase-order/domain/factories/purchase-order.factory';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderQuery,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryAuditPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makePo() {
  return PurchaseOrderFactory.create({
    orderNumber: 'PO-00000001',
    vendorId: '11111111-1111-1111-1111-111111111111',
  });
}

function makeSut(opts?: { hasReceipts?: boolean; abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = makePo();
  repo.store.set(po.id.toString(), po);

  const query = new InMemoryPurchaseOrderQuery();
  query.receiptsById.set(po.id.toString(), opts?.hasReceipts ?? false);

  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const audit = new InMemoryAuditPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new CancelPurchaseOrderUseCase(repo, query, publisher, ctx, audit, abac);
  return { useCase, repo, publisher, audit, po };
}

describe('CancelPurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('cancels a draft purchase order', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.CANCELLED);
  });

  it('records an audit entry', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString());
    expect(audit.entries[0].action).toBe('purchase-order.cancel');
  });

  it('refuses to cancel when receipts exist', async () => {
    const { useCase, po } = makeSut({ hasReceipts: true });
    await expect(useCase.execute(po.id.toString())).rejects.toThrow(
      'Cannot cancel a purchase order with posted receipts',
    );
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(useCase.execute(po.id.toString())).rejects.toThrow(NotFoundException);
  });
});
