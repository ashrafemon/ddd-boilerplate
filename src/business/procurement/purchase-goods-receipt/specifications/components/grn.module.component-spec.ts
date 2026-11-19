import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { GoodReceiptNoteModule } from '@business/procurement/purchase-goods-receipt/purchase-goods-receipt.module';
import { CreateGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/create-grn.usecase';
import { PostGrnUseCase } from '@business/procurement/purchase-goods-receipt/application/use-cases/post-grn.usecase';
import { GrnCommandRepository } from '@business/procurement/purchase-goods-receipt/domain/repositories/grn-command.repository';
import { GrnQuery } from '@business/procurement/purchase-goods-receipt/application/queries/grn.query';
import { PurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/purchase-order-query.port';
import { NumberingPort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/numbering.port';
import { ReadCachePort } from '@business/procurement/purchase-goods-receipt/application/outbound-ports/read-cache.port';
import { GrnForPurchaseOrderPort } from '@business/procurement/purchase-goods-receipt/public/ports/grn-for-purchase-order.port';
import { GrnForPurchaseOrderFacade } from '@business/procurement/purchase-goods-receipt/application/facades/grn-for-purchase-order.facade';
import { GoodReceiptNote } from '@business/procurement/purchase-goods-receipt/domain/aggregates/grn.aggregate';
import { GrnQueryRecord } from '@business/procurement/purchase-goods-receipt/domain/types/grn.types';
import { PurchaseOrderReference } from '@business/procurement/purchase-order/public/contracts/purchase-order-for-grn.contract';
import {
  PurchaseOrderReceiptRequest,
  PurchaseOrderReceiptResult,
} from '@business/procurement/purchase-order/public/contracts/purchase-order-receipt.contract';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { ComponentModuleOptions, createComponentModule } from '@test/utils/component-module';
import {
  AllowAbacPort,
  COMPONENT_CONTEXT,
  RecordingOutboxWriter,
} from '@test/support/platform/fake-platform-ports';

/**
 * Goods receipt note — component tests: the real `GoodReceiptNoteModule` graph
 * with faked repositories, numbering, cache, purchase-order port and outbox.
 */

class InMemoryGrnCommandRepository extends GrnCommandRepository {
  public readonly byId = new Map<string, GoodReceiptNote>();

  public async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    this.byId.set(grn.id.toString(), grn);
    return grn;
  }

  public async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    this.byId.set(grn.id.toString(), grn);
    return grn;
  }

  public async findById(id: string): Promise<GoodReceiptNote | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null> {
    return [...this.byId.values()].find(grn => grn.grnNumber === grnNumber) ?? null;
  }

  public async findByReversalOfId(): Promise<GoodReceiptNote | null> {
    return null;
  }
}

class InMemoryGrnQuery extends GrnQuery {
  constructor(private readonly command: InMemoryGrnCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<GrnQueryRecord | null> {
    const grn = await this.command.findById(id);
    return grn ? (grn as unknown as GrnQueryRecord) : null;
  }

  public async findByGrnNumber(grnNumber: string): Promise<GrnQueryRecord | null> {
    const grn = await this.command.findByGrnNumber(grnNumber);
    return grn ? (grn as unknown as GrnQueryRecord) : null;
  }

  public async findAll(query: { page: number; pageSize: number }) {
    const items = [...this.command.byId.values()] as unknown as GrnQueryRecord[];
    const pageSize = query.pageSize;
    return {
      items,
      total: items.length,
      page: query.page,
      pageSize,
      totalPages: Math.ceil(items.length / pageSize),
    };
  }
}

class FakePurchaseOrderPort extends PurchaseOrderPort {
  public readonly orders = new Map<string, PurchaseOrderReference>();
  public readonly receipts: PurchaseOrderReceiptRequest[] = [];

  public async getPurchaseOrder(id: string): Promise<PurchaseOrderReference | null> {
    return this.orders.get(id) ?? null;
  }

  public async registerReceipt(
    request: PurchaseOrderReceiptRequest,
  ): Promise<PurchaseOrderReceiptResult> {
    this.receipts.push(request);
    return {
      purchaseOrderId: request.purchaseOrderId,
      receiptStatus: 'PARTIALLY_RECEIVED',
      lines: request.lines.map(line => ({
        productId: line.productId,
        orderedQuantity: 10,
        receivedQuantity: line.receivedQuantity,
        remainingQuantity: 10 - line.receivedQuantity,
      })),
    };
  }

  public async hasReceipts(): Promise<boolean> {
    return false;
  }
}

class FakeNumberingPort extends NumberingPort {
  private seq = 0;

  public async nextNumber(
    sequenceKey: string,
    options?: { prefix?: string; padding?: number },
  ): Promise<string> {
    this.seq += 1;
    const padded = String(this.seq).padStart(options?.padding ?? 8, '0');
    return options?.prefix ? `${options.prefix}${padded}` : `${sequenceKey}-${padded}`;
  }
}

class FakeReadCachePort extends ReadCachePort {
  public async getOrLoad<T>(_key: string, load: () => Promise<T>): Promise<T> {
    return load();
  }

  public async invalidate(): Promise<void> {}
}

describe('GoodReceiptNote module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryGrnCommandRepository;
  let purchaseOrders: FakePurchaseOrderPort;
  let outbox: RecordingOutboxWriter;

  function purchaseOrder(overrides: Partial<PurchaseOrderReference> = {}): PurchaseOrderReference {
    return {
      id: 'po-1',
      orderNumber: 'PO-00000001',
      vendorId: 'vendor-1',
      status: 'ISSUED',
      currency: 'USD',
      subtotal: 100,
      total: 100,
      lines: [{ productId: 'product-1', quantity: 10, unitPrice: 10, total: 100 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  async function build(platform: ComponentModuleOptions['platform'] = []): Promise<TestingModule> {
    command = new InMemoryGrnCommandRepository();
    purchaseOrders = new FakePurchaseOrderPort();
    purchaseOrders.orders.set('po-1', purchaseOrder());
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(GoodReceiptNoteModule, {
      overrides: [
        { provide: GrnCommandRepository, useValue: command },
        { provide: GrnQuery, useValue: new InMemoryGrnQuery(command) },
        { provide: PurchaseOrderPort, useValue: purchaseOrders },
        { provide: NumberingPort, useValue: new FakeNumberingPort() },
        { provide: ReadCachePort, useValue: new FakeReadCachePort() },
        { provide: OutboxWriterPort, useValue: outbox },
      ],
      platform: [...(platform ?? [])],
    });
    return moduleRef;
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resolves the command use cases from the container', async () => {
    await build();

    expect(moduleRef.get(CreateGrnUseCase)).toBeInstanceOf(CreateGrnUseCase);
    expect(moduleRef.get(PostGrnUseCase)).toBeInstanceOf(PostGrnUseCase);
  });

  it('binds the public GrnForPurchaseOrderPort to its facade', async () => {
    await build();

    expect(moduleRef.get(GrnForPurchaseOrderPort)).toBeInstanceOf(GrnForPurchaseOrderFacade);
  });

  it('creates a GRN through the graph and emits one outbox event', async () => {
    await build();

    const id = await moduleRef.get(CreateGrnUseCase).execute({
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'product-1', orderedQuantity: 10, receivedQuantity: 4, unitPrice: 10 }],
    });

    expect(command.byId.get(id)).toBeDefined();
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('GoodReceiptNote');
    expect(outbox.appended[0].aggregateId).toBe(id);
  });

  it('refuses a purchase order that is not receiving-eligible', async () => {
    await build();
    purchaseOrders.orders.set('po-1', purchaseOrder({ status: 'DRAFT' }));

    await expect(
      moduleRef.get(CreateGrnUseCase).execute({
        purchaseOrderId: 'po-1',
        lines: [
          { productId: 'product-1', orderedQuantity: 10, receivedQuantity: 1, unitPrice: 10 },
        ],
      }),
    ).rejects.toThrow(ConflictException);
    expect(command.byId.size).toBe(0);
  });

  it('refuses a vendor that differs from the purchase order vendor', async () => {
    await build();

    await expect(
      moduleRef.get(CreateGrnUseCase).execute({
        purchaseOrderId: 'po-1',
        vendorId: 'other-vendor',
        lines: [
          { productId: 'product-1', orderedQuantity: 10, receivedQuantity: 1, unitPrice: 10 },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('reports an unknown purchase order as 404, never 403', async () => {
    await build();

    await expect(
      moduleRef.get(CreateGrnUseCase).execute({
        purchaseOrderId: 'po-missing',
        lines: [{ productId: 'product-1', orderedQuantity: 1, receivedQuantity: 1, unitPrice: 1 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('fails closed when the platform ABAC double denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef.get(CreateGrnUseCase).execute({
        purchaseOrderId: 'po-1',
        lines: [
          { productId: 'product-1', orderedQuantity: 10, receivedQuantity: 1, unitPrice: 10 },
        ],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('evaluates ABAC with the platform identity and Grn resource', async () => {
    await build();
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef.get(CreateGrnUseCase).execute({
      purchaseOrderId: 'po-1',
      lines: [{ productId: 'product-1', orderedQuantity: 10, receivedQuantity: 1, unitPrice: 10 }],
    });

    expect(abac.lastCheck().context.companyId).toBe(COMPONENT_CONTEXT.companyId);
    expect(abac.lastCheck().resource).toBe('Grn');
    expect(abac.lastCheck().action).toBe('create');
  });
});
