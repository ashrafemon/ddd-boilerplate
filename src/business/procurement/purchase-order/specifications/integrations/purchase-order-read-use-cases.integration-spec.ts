import { NotFoundException } from '@nestjs/common';
import { GetPurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order.usecase';
import { HasPurchaseOrderReceiptsUseCase } from '@business/procurement/purchase-order/application/use-cases/has-purchase-order-receipts.usecase';
import { GetPurchaseOrderReceiptsUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order-receipts.usecase';
import { GetPurchaseOrderRemainingQuantitiesUseCase } from '@business/procurement/purchase-order/application/use-cases/get-purchase-order-remaining-quantities.usecase';
import { ListPurchaseOrdersUseCase } from '@business/procurement/purchase-order/application/use-cases/list-purchase-orders.usecase';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import {
  PurchaseOrderQueryRecord,
  PurchaseOrderReceiptsQueryRecord,
} from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { PageQuery, PageResult } from '@common/application/types/pagination';

function makeRecord(overrides?: Partial<PurchaseOrderQueryRecord>): PurchaseOrderQueryRecord {
  return {
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
    ...overrides,
  };
}

class InMemoryPurchaseOrderQuery extends PurchaseOrderQuery {
  public readonly records = new Map<string, PurchaseOrderQueryRecord>();
  public readonly receipts = new Map<string, PurchaseOrderReceiptsQueryRecord>();
  public readonly receiptsFlags = new Map<string, boolean>();

  async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    return this.records.get(id) ?? null;
  }
  async findByOrderNumber(): Promise<PurchaseOrderQueryRecord | null> {
    return null;
  }
  async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    const items = [...this.records.values()];
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length,
      totalPages: 1,
    };
  }
  async findReceipts(id: string): Promise<PurchaseOrderReceiptsQueryRecord | null> {
    return this.receipts.get(id) ?? null;
  }
  async hasReceipts(id: string): Promise<boolean> {
    return this.receiptsFlags.get(id) ?? false;
  }
}

function makeQuery(): InMemoryPurchaseOrderQuery {
  const query = new InMemoryPurchaseOrderQuery();
  query.records.set('po-1', makeRecord());
  query.receipts.set('po-1', {
    purchaseOrderId: 'po-1',
    lines: [{ productId: 'p1', orderedQuantity: 10, receivedQuantity: 4, remainingQuantity: 6 }],
  });
  query.receiptsFlags.set('po-1', true);
  return query;
}

describe('PurchaseOrder read use cases (integration)', () => {
  it('GetPurchaseOrderUseCase returns the record', async () => {
    const useCase = new GetPurchaseOrderUseCase(makeQuery());
    const result = await useCase.execute('po-1');
    expect(result.orderNumber).toBe('PO-00000001');
  });

  it('GetPurchaseOrderUseCase throws when missing', async () => {
    const useCase = new GetPurchaseOrderUseCase(makeQuery());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('HasPurchaseOrderReceiptsUseCase reflects the flag', async () => {
    const useCase = new HasPurchaseOrderReceiptsUseCase(makeQuery());
    await expect(useCase.execute('po-1')).resolves.toBe(true);
    await expect(useCase.execute('other')).resolves.toBe(false);
  });

  it('GetPurchaseOrderReceiptsUseCase derives the receipt status', async () => {
    const useCase = new GetPurchaseOrderReceiptsUseCase(makeQuery());
    const result = await useCase.execute('po-1');
    expect(result.receiptStatus).toBe('PARTIALLY_RECEIVED');
    expect(result.lines[0].remainingQuantity).toBe(6);
  });

  it('GetPurchaseOrderReceiptsUseCase throws when the order is missing', async () => {
    const useCase = new GetPurchaseOrderReceiptsUseCase(makeQuery());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('GetPurchaseOrderRemainingQuantitiesUseCase returns remaining per line', async () => {
    const useCase = new GetPurchaseOrderRemainingQuantitiesUseCase(makeQuery());
    const result = await useCase.execute('po-1');
    expect(result.lines[0]).toEqual({
      productId: 'p1',
      orderedQuantity: 10,
      receivedQuantity: 4,
      remainingQuantity: 6,
    });
  });

  it('ListPurchaseOrdersUseCase returns a page', async () => {
    const useCase = new ListPurchaseOrdersUseCase(makeQuery());
    const result = await useCase.execute({ page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
  });
});
