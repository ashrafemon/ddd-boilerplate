import { NotFoundException } from '@nestjs/common';
import { IssuePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/issue-purchase-order.usecase';
import { CompletePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/complete-purchase-order.usecase';
import { ClosePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/close-purchase-order.usecase';
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

function approvedPo() {
  return makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }], {
    status: PurchaseOrderStatus.APPROVED,
  });
}

function issuedPo() {
  return makePurchaseOrderWithLines([{ productId: 'p1', quantity: 5, unitPriceMinor: 500 }], {
    status: PurchaseOrderStatus.ISSUED,
  });
}

describe('IssuePurchaseOrderUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('issues an APPROVED purchase order', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = approvedPo();
    repo.store.set(po.id.toString(), po);
    const publisher = new InMemoryPurchaseOrderPublisherPort();
    const audit = new InMemoryAuditPort();
    const useCase = new IssuePurchaseOrderUseCase(repo, publisher, makeContext(), audit);

    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.ISSUED);
    expect(audit.entries[0].action).toBe('purchase-order.issue');
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const useCase = new IssuePurchaseOrderUseCase(
      repo,
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new InMemoryAuditPort(),
    );
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('CompletePurchaseOrderUseCase (integration)', () => {
  it('completes an ISSUED purchase order', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = issuedPo();
    repo.store.set(po.id.toString(), po);
    const audit = new InMemoryAuditPort();
    const useCase = new CompletePurchaseOrderUseCase(
      repo,
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      audit,
      new AllowAbacAdapter(),
    );

    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.COMPLETED);
    expect(audit.entries[0].action).toBe('purchase-order.complete');
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = issuedPo();
    repo.store.set(po.id.toString(), po);
    const useCase = new CompletePurchaseOrderUseCase(
      repo,
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext({ companyId: undefined }),
      new InMemoryAuditPort(),
      new DenyAbacAdapter(),
    );
    await expect(useCase.execute(po.id.toString())).rejects.toThrow(NotFoundException);
  });
});

describe('ClosePurchaseOrderUseCase (integration)', () => {
  it('closes a purchase order', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const po = issuedPo();
    repo.store.set(po.id.toString(), po);
    const audit = new InMemoryAuditPort();
    const useCase = new ClosePurchaseOrderUseCase(
      repo,
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      audit,
    );

    const id = await useCase.execute(po.id.toString());
    expect(id).toBe(po.id.toString());
    expect(repo.updates[0].status).toBe(PurchaseOrderStatus.COMPLETED);
    expect(audit.entries[0].action).toBe('purchase-order.close');
  });

  it('throws NotFoundException when the purchase order does not exist', async () => {
    const repo = new InMemoryPurchaseOrderRepository();
    const useCase = new ClosePurchaseOrderUseCase(
      repo,
      new InMemoryPurchaseOrderPublisherPort(),
      makeContext(),
      new InMemoryAuditPort(),
    );
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });
});
