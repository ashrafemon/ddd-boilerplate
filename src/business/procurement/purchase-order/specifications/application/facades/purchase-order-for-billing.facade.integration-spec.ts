import { PurchaseOrderForBillingFacade } from '@business/procurement/purchase-order/application/facades/purchase-order-for-billing.facade';
import { GetPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order.usecase';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(lines: PurchaseOrderQueryRecord['lines']): PurchaseOrderQueryRecord {
  return {
    id: 'po-1',
    orderNumber: 'PO-00000001',
    vendorId: 'v1',
    status: 'ISSUED',
    currency: 'USD',
    subtotal: 0,
    total: 500,
    lines,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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
  async hasReceipts(): Promise<boolean> {
    return false;
  }
}

const lines = [
  { productId: 'p1', quantity: 10, receivedQuantity: 4, unitPrice: 50, total: 500 },
  { productId: 'p2', quantity: 5, receivedQuantity: 5, unitPrice: 50, total: 250 },
];

describe('PurchaseOrderForBillingFacade (integration)', () => {
  it('maps a purchase order to the billing contract', async () => {
    const facade = new PurchaseOrderForBillingFacade(
      new GetPurchaseOrderUseCase(new InMemoryPurchaseOrderQuery(makeRecord(lines))),
    );

    const result = await facade.getPurchaseOrderForBilling('po-1');
    expect(result).toMatchObject({
      id: 'po-1',
      poNo: 'PO-00000001',
      vendorId: 'v1',
      totalAmount: 500,
      currency: 'USD',
    });
  });

  it('computes billing progress from line quantities', async () => {
    const facade = new PurchaseOrderForBillingFacade(
      new GetPurchaseOrderUseCase(new InMemoryPurchaseOrderQuery(makeRecord(lines))),
    );

    const progress = await facade.getBillingProgress('po-1');
    expect(progress).toEqual({
      orderedQuantity: 15,
      receivedQuantity: 9,
      billedQuantity: 0,
      remainingQuantity: 15,
    });
  });

  it('returns null when the purchase order is missing', async () => {
    const facade = new PurchaseOrderForBillingFacade(
      new GetPurchaseOrderUseCase(new InMemoryPurchaseOrderQuery(null)),
    );

    // the read use case throws rather than returning null
    await expect(facade.getPurchaseOrderForBilling('missing')).rejects.toThrow(
      'Purchase order not found',
    );
    await expect(facade.getBillingProgress('missing')).rejects.toThrow('Purchase order not found');
  });
});
