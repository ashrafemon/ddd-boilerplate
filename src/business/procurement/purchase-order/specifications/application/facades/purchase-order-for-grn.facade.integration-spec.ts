import { PurchaseOrderForGrnFacade } from '@business/procurement/purchase-order/application/facades/purchase-order-for-grn.facade';
import { GetPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order.usecase';
import { HasPurchaseOrderReceiptsUseCase } from '@business/procurement/purchase-order/application/use-cases/has-purchase-order-receipts.usecase';
import { RegisterPurchaseOrderReceiptUseCase } from '@business/procurement/purchase-order/application/use-cases/register-purchase-order-receipt.usecase';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { InMemoryPurchaseOrderRepository } from '@test/support/purchase-order/purchase-order.fakes';
import { PageQuery, PageResult } from '@common/application/types/pagination';

class InMemoryPurchaseOrderQuery extends PurchaseOrderQuery {
  constructor(private readonly record: PurchaseOrderQueryRecord | null) {
    super();
  }
  async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.record && this.record.id === id ? this.record : null;
  }
  async findByOrderNumber(): Promise<PurchaseOrderQueryRecord | null> {
    return null;
  }
  async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
  }
  async findReceipts(): Promise<null> {
    return null;
  }
  async hasReceipts(id: string): Promise<boolean> {
    return id === 'po-1';
  }
}

const record: PurchaseOrderQueryRecord = {
  id: 'po-1',
  orderNumber: 'PO-00000001',
  vendorId: 'v1',
  status: 'DRAFT',
  currency: 'USD',
  subtotal: 0,
  total: 0,
  lines: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('PurchaseOrderForGrnFacade (integration)', () => {
  const query = new InMemoryPurchaseOrderQuery(record);
  const facade = new PurchaseOrderForGrnFacade(
    new GetPurchaseOrderUseCase(query),
    new RegisterPurchaseOrderReceiptUseCase(
      new InMemoryPurchaseOrderRepository(),
      null as never,
      null as never,
    ),
    new HasPurchaseOrderReceiptsUseCase(query),
  );

  it('delegates getPurchaseOrder', async () => {
    await expect(facade.getPurchaseOrder('po-1')).resolves.toMatchObject({
      orderNumber: 'PO-00000001',
    });
    // the read use case throws rather than returning null
    await expect(facade.getPurchaseOrder('missing')).rejects.toThrow('Purchase order not found');
  });

  it('delegates hasReceipts', async () => {
    await expect(facade.hasReceipts('po-1')).resolves.toBe(true);
    await expect(facade.hasReceipts('other')).resolves.toBe(false);
  });
});
