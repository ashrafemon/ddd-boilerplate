import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/create-grn.usecase';
import { GrnCommandRepository } from '@business/procurement/purchase-goods-receipt/domain/repositories/grn-command.repository';
import { PurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/purchase-order-query.port';
import { NumberingPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/numbering.port';
import { GrnPublisherPort } from '@business/procurement/purchase-goods-receipt/application/publishes/publishers/grn.publisher-port';
import { GoodReceiptNote } from '@business/procurement/purchase-goods-receipt/domain/aggregates/grn.aggregate';
import { OutboxEvent } from '@platform/platform-common/outbox/types/outbox.types';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';
import {
  AbacPort,
  AbacResult,
  AbacCheck,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

// ---- Fakes ----

class InMemoryGrnRepository extends GrnCommandRepository {
  public readonly saved: GoodReceiptNote[] = [];

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    this.saved.push(grn);
    return grn;
  }
  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    return grn;
  }
  async findById(): Promise<GoodReceiptNote | null> {
    return null;
  }
  async findByGrnNumber(): Promise<GoodReceiptNote | null> {
    return null;
  }
  async findByReversalOfId(): Promise<GoodReceiptNote | null> {
    return null;
  }
}

class InMemoryPurchaseOrderQueryPort extends PurchaseOrderPort {
  constructor(private readonly po: PurchaseOrderReference | null) {
    super();
  }
  async getPurchaseOrder(_id: string): Promise<PurchaseOrderReference | null> {
    return this.po;
  }
  async registerReceipt(
    _request: PurchaseOrderReceiptRequest,
  ): Promise<PurchaseOrderReceiptResult> {
    return {
      purchaseOrderId: _request.purchaseOrderId,
      receiptStatus: 'NOT_RECEIVED',
      lines: [],
    };
  }
  async hasReceipts(_purchaseOrderId: string): Promise<boolean> {
    return false;
  }
}

class InMemoryNumberingPort extends NumberingPort {
  private counter = 0;
  async nextNumber(_key: string, options?: { prefix?: string; padding?: number }): Promise<string> {
    this.counter++;
    return `${options?.prefix ?? 'GRN-'}${String(this.counter).padStart(options?.padding ?? 8, '0')}`;
  }
}

class InMemoryGrnPublisherPort extends GrnPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _grnId: string): Promise<void> {
    this.events.push(event);
  }
}

class AllowAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'ALLOW' };
  }
}

class DenyAbacAdapter extends AbacPort {
  async evaluate(_check: AbacCheck): Promise<AbacResult> {
    return { decision: 'DENY', reason: 'Denied' };
  }
}

// ---- Helpers ----

function makePO(overrides?: Partial<PurchaseOrderReference>): PurchaseOrderReference {
  return {
    id: 'po-1',
    orderNumber: 'PO-00000001',
    vendorId: 'vendor-1',
    status: 'ISSUED',
    currency: 'USD',
    subtotal: 0,
    total: 0,
    lines: [
      { productId: 'prod-1', quantity: 10, unitPrice: 500, total: 5000 },
      { productId: 'prod-2', quantity: 5, unitPrice: 1000, total: 5000 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Tests ----

describe('CreateGrnUseCase (integration)', () => {
  beforeAll(() => {
    initNoopTransactionHost();
  });

  const defaultContext = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    userId: 'user-1',
    roles: ['admin'],
    defaultCurrency: 'USD',
  };

  function makeSut(opts?: {
    po?: PurchaseOrderReference | null;
    abacDeny?: boolean;
    noCompany?: boolean;
  }) {
    const repo = new InMemoryGrnRepository();
    const poPort = new InMemoryPurchaseOrderQueryPort(opts?.po ?? null);
    const numbering = new InMemoryNumberingPort();
    const publisher = new InMemoryGrnPublisherPort();
    const ctx = new InMemoryRequestContextService(
      opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
    );
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new CreateGrnUseCase(repo, poPort, publisher, numbering, ctx, abac);
    return { useCase, repo, publisher, ctx };
  }

  it('creates a GRN against an ISSUED PO', async () => {
    const { useCase, repo, publisher } = makeSut({ po: makePO() });
    const id = await useCase.execute({
      purchaseOrderId: 'po-1',
      lines: [
        { productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 },
        { productId: 'prod-2', orderedQuantity: 5, receivedQuantity: 5, unitPrice: 1000 },
      ],
    });

    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].purchaseOrderId).toBe('po-1');
    expect(repo.saved[0].lines).toHaveLength(2);
    expect(publisher.events).toHaveLength(1);
  });

  it('snapshots orderedQuantity and unitPrice from PO (ignores client values)', async () => {
    const { useCase, repo } = makeSut({ po: makePO() });
    await useCase.execute({
      purchaseOrderId: 'po-1',
      lines: [
        // client sends wrong values — should be overwritten from PO
        { productId: 'prod-1', orderedQuantity: 999, receivedQuantity: 8, unitPrice: 1 },
      ],
    });

    const grn = repo.saved[0];
    expect(grn.lines[0].orderedQuantity).toBe(10); // from PO
    expect(grn.lines[0].unitPrice).toBe(500); // from PO
  });

  it('throws NotFoundException when PO not found', async () => {
    const { useCase } = makeSut({ po: null });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        lines: [{ productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when PO is not receiving-eligible', async () => {
    const { useCase } = makeSut({ po: makePO({ status: 'DRAFT' }) });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        lines: [{ productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when vendor does not match PO vendor', async () => {
    const { useCase } = makeSut({ po: makePO() });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        vendorId: 'different-vendor',
        lines: [{ productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when product not on PO', async () => {
    const { useCase } = makeSut({ po: makePO() });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        lines: [
          {
            productId: 'unknown-product',
            orderedQuantity: 10,
            receivedQuantity: 8,
            unitPrice: 500,
          },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        lines: [{ productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(
      useCase.execute({
        purchaseOrderId: 'po-1',
        lines: [{ productId: 'prod-1', orderedQuantity: 10, receivedQuantity: 8, unitPrice: 500 }],
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
