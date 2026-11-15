import { NotFoundException } from '@nestjs/common';
import { RejectPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/reject-purchase-order.usecase';
import { PurchaseOrderStatus } from '@business/procurement/purchase-order/domain/types/purchase-order.enum';
import {
  InMemoryPurchaseOrderRepository,
  InMemoryPurchaseOrderPublisherPort,
  InMemoryAuditPort,
  AllowAbacAdapter,
  DenyAbacAdapter,
  makeContext,
  makePurchaseOrderWithLines,
} from '@test/support/purchase-order/purchase-order.fakes';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

function makeSubmittedPo() {
  return makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }], {
    status: PurchaseOrderStatus.SUBMITTED,
  });
}

function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryPurchaseOrderRepository();
  const po = makeSubmittedPo();
  repo.store.set(po.id.toString(), po);
  const publisher = new InMemoryPurchaseOrderPublisherPort();
  const audit = new InMemoryAuditPort();
  const ctx = makeContext(opts?.noCompany ? { companyId: undefined } : undefined);
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new RejectPurchaseOrderUseCase(repo, publisher, ctx, audit, abac);
  return { useCase, repo, publisher, audit, po };
}

describe('RejectPurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('rejects a submitted purchase order with a reason', async () => {
    const { useCase, repo, po } = makeSut();
    const id = await useCase.execute(po.id.toString(), 'Over budget');
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.REJECTED);
    expect(repo.updates[0].rejectionReason).toBe('Over budget');
  });

  it('records an audit entry with the reason', async () => {
    const { useCase, audit, po } = makeSut();
    await useCase.execute(po.id.toString(), 'Over budget');
    expect(audit.entries[0].action).toBe('purchase-order.reject');
    expect(audit.entries[0].changes).toMatchObject({ reason: 'Over budget' });
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute('missing', 'reason')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, po } = makeSut({ noCompany: true });
    await expect(useCase.execute(po.id.toString(), 'reason')).rejects.toThrow(NotFoundException);
  });
});
