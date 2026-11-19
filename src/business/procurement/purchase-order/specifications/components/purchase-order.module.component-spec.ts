import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { PurchaseOrderModule } from '@business/procurement/purchase-order/purchase-order.module';
import { CreatePurchaseOrderUseCase } from '@business/procurement/purchase-order/application/use-cases/create-purchase-order.usecase';
import { AddPurchaseOrderLineUseCase } from '@business/procurement/purchase-order/application/use-cases/add-purchase-order-line.usecase';
import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { PurchaseOrderQuery } from '@business/procurement/purchase-order/application/queries/purchase-order.query';
import { PurchasableProductPort } from '@business/procurement/purchase-order/application/outbound-ports/product-query.port';
import { OrderableVendorPort } from '@business/procurement/purchase-order/application/outbound-ports/vendor-query.port';
import { ReadCachePort } from '@business/procurement/purchase-order/application/outbound-ports/read-cache.port';
import { NumberingPort } from '@business/procurement/purchase-order/application/outbound-ports/numbering.port';
import { PurchaseOrderForGrnPort } from '@business/procurement/purchase-order/public/ports/purchase-order-for-grn.port';
import { PurchaseOrderForGrnFacade } from '@business/procurement/purchase-order/application/facades/purchase-order-for-grn.facade';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderQueryRecord } from '@business/procurement/purchase-order/domain/types/purchase-order.types';
import { ProductReference } from '@business/product-management/product/public/contracts/product-for-purchase.contract';
import { VendorReference } from '@business/party/vendor/public/contracts/vendor-for-purchase.contract';
import { PageQuery, PageResult } from '@common/application/types/pagination';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { ComponentModuleOptions, createComponentModule } from '@test/utils/component-module';
import {
  AllowAbacPort,
  COMPONENT_CONTEXT,
  RecordingOutboxWriter,
} from '@test/support/platform/fake-platform-ports';

/**
 * Purchase order — component tests: the real `PurchaseOrderModule` graph
 * (32 declared providers incl. listeners, facades, `useFactory` bindings and
 * outbound adapters) with every IO edge faked.
 */

class InMemoryPurchaseOrderCommandRepository extends PurchaseOrderCommandRepository {
  public readonly byId = new Map<string, PurchaseOrder>();

  public async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    this.byId.set(purchaseOrder.id.toString(), purchaseOrder);
    return purchaseOrder;
  }

  public async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    this.byId.set(purchaseOrder.id.toString(), purchaseOrder);
    return purchaseOrder;
  }

  public async findById(id: string): Promise<PurchaseOrder | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    return [...this.byId.values()].find(order => order.orderNumber === orderNumber) ?? null;
  }

  public async findByExternalReference(externalReference: string): Promise<PurchaseOrder | null> {
    return (
      [...this.byId.values()].find(order => order.externalReference === externalReference) ?? null
    );
  }
}

class InMemoryPurchaseOrderQuery extends PurchaseOrderQuery {
  constructor(private readonly command: InMemoryPurchaseOrderCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<PurchaseOrderQueryRecord | null> {
    const order = await this.command.findById(id);
    return order ? (order as unknown as PurchaseOrderQueryRecord) : null;
  }

  public async findByOrderNumber(orderNumber: string): Promise<PurchaseOrderQueryRecord | null> {
    const order = await this.command.findByOrderNumber(orderNumber);
    return order ? (order as unknown as PurchaseOrderQueryRecord) : null;
  }

  public async findAll(query: PageQuery): Promise<PageResult<PurchaseOrderQueryRecord>> {
    const items = [...this.command.byId.values()] as unknown as PurchaseOrderQueryRecord[];
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      items,
      total: items.length,
      page,
      pageSize,
      totalPages: Math.ceil(items.length / pageSize),
    };
  }

  public async findReceipts(): Promise<null> {
    return null;
  }

  public async hasReceipts(): Promise<boolean> {
    return false;
  }
}

class FakePurchasableProductPort extends PurchasableProductPort {
  public async getPurchasableProduct(id: string): Promise<ProductReference | null> {
    return {
      id,
      sku: 'SKU-' + id,
      name: 'Widget',
      description: null,
      status: 'ACTIVE',
      unitPrice: 5,
      currency: 'USD',
    };
  }

  public async findPurchasableProductsBySkus(skus: string[]): Promise<ProductReference[]> {
    return skus.map(sku => ({
      id: sku,
      sku,
      name: 'Widget',
      description: null,
      status: 'ACTIVE',
      unitPrice: 5,
      currency: 'USD',
    }));
  }
}

class FakeOrderableVendorPort extends OrderableVendorPort {
  public async getOrderableVendor(id: string): Promise<VendorReference | null> {
    return this.vendors.get(id) ?? null;
  }

  public async findOrderableVendorsByCodes(codes: string[]): Promise<VendorReference[]> {
    return [...this.vendors.values()].filter(vendor => codes.includes(vendor.code));
  }

  public readonly vendors = new Map<string, VendorReference>();
}

class FakeReadCachePort extends ReadCachePort {
  public async getOrLoad<T>(_key: string, load: () => Promise<T>): Promise<T> {
    return load();
  }

  public async invalidate(): Promise<void> {}
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

describe('PurchaseOrder module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryPurchaseOrderCommandRepository;
  let vendors: FakeOrderableVendorPort;
  let outbox: RecordingOutboxWriter;

  async function build(platform: ComponentModuleOptions['platform'] = []): Promise<TestingModule> {
    command = new InMemoryPurchaseOrderCommandRepository();
    vendors = new FakeOrderableVendorPort();
    vendors.vendors.set('vendor-1', {
      id: 'vendor-1',
      code: 'VEN-1',
      name: 'Acme',
      email: null,
      phone: null,
      address: null,
      status: 'ACTIVE',
    });
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(PurchaseOrderModule, {
      overrides: [
        { provide: PurchaseOrderCommandRepository, useValue: command },
        { provide: PurchaseOrderQuery, useValue: new InMemoryPurchaseOrderQuery(command) },
        { provide: PurchasableProductPort, useValue: new FakePurchasableProductPort() },
        { provide: OrderableVendorPort, useValue: vendors },
        { provide: ReadCachePort, useValue: new FakeReadCachePort() },
        { provide: NumberingPort, useValue: new FakeNumberingPort() },
        { provide: OutboxWriterPort, useValue: outbox },
      ],
      platform: [...(platform ?? [])],
    });
    return moduleRef;
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resolves the main commands from the container', async () => {
    await build();

    expect(moduleRef.get(CreatePurchaseOrderUseCase)).toBeInstanceOf(CreatePurchaseOrderUseCase);
    expect(moduleRef.get(AddPurchaseOrderLineUseCase)).toBeInstanceOf(AddPurchaseOrderLineUseCase);
  });

  it('binds the public PurchaseOrderForGrnPort to its facade', async () => {
    await build();

    expect(moduleRef.get(PurchaseOrderForGrnPort)).toBeInstanceOf(PurchaseOrderForGrnFacade);
  });

  it('creates an order through the graph: numbered, persisted, one outbox event', async () => {
    await build();

    const id = await moduleRef.get(CreatePurchaseOrderUseCase).execute({
      vendorId: 'vendor-1',
      currency: 'USD',
    });

    const created = command.byId.get(id);
    expect(created).toBeDefined();
    expect(created!.orderNumber).toMatch(/^PO-\d{8}$/);
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('PurchaseOrder');
    expect(outbox.appended[0].aggregateId).toBe(id);
  });

  it('rejects an unknown or non-orderable vendor through the wired port', async () => {
    await build();

    await expect(
      moduleRef.get(CreatePurchaseOrderUseCase).execute({ vendorId: 'vendor-unknown' }),
    ).rejects.toThrow(ConflictException);
    expect(command.byId.size).toBe(0);
  });

  it('fails closed when the platform ABAC double denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef.get(CreatePurchaseOrderUseCase).execute({ vendorId: 'vendor-1' }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('reads ABAC identity from the platform context', async () => {
    await build();
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef.get(CreatePurchaseOrderUseCase).execute({ vendorId: 'vendor-1' });

    expect(abac.lastCheck().context.companyId).toBe(COMPONENT_CONTEXT.companyId);
    expect(abac.lastCheck().resource).toBe('PurchaseOrder');
    expect(abac.lastCheck().action).toBe('create');
  });
});
