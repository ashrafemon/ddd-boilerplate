import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { ProductModule } from '@business/product-management/product/product.module';
import { CreateProductUseCase } from '@business/product-management/product/application/use-cases/create-product.usecase';
import { GetProductUseCase } from '@business/product-management/product/application/use-cases/get-product.usecase';
import { ProductCommandRepository } from '@business/product-management/product/domain/repositories/product-command.repository';
import { ProductQuery } from '@business/product-management/product/application/queries/product.query';
import { ProductForPurchasePort } from '@business/product-management/product/public/ports/product-for-purchase.port';
import { ProductForSalesPort } from '@business/product-management/product/public/ports/product-for-sales.port';
import { ProductForPurchaseFacade } from '@business/product-management/product/application/facades/product-for-purchase.facade';
import { Product } from '@business/product-management/product/domain/aggregates/product.aggregate';
import { ProductQueryRecord } from '@business/product-management/product/domain/types/product.types';
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
 * Product — component tests: the real `ProductModule` provider graph with every
 * IO edge replaced, so bindings (`useExisting`, the outbox `useFactory`, the
 * repository tokens) are exercised the way production wires them.
 */

class InMemoryProductCommandRepository extends ProductCommandRepository {
  public readonly byId = new Map<string, Product>();

  public async findById(id: string): Promise<Product | null> {
    return this.byId.get(id) ?? null;
  }

  public async findBySku(sku: string): Promise<Product | null> {
    return (
      [...this.byId.values()].find(product => product.sku === sku.trim().toUpperCase()) ?? null
    );
  }

  public async save(product: Product): Promise<Product> {
    this.byId.set(product.id.toString(), product);
    return product;
  }

  public async update(product: Product): Promise<Product> {
    this.byId.set(product.id.toString(), product);
    return product;
  }
}

class InMemoryProductQuery extends ProductQuery {
  constructor(private readonly command: InMemoryProductCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<ProductQueryRecord | null> {
    const product = await this.command.findById(id);
    return product ? this.toRecord(product) : null;
  }

  public async findBySku(sku: string): Promise<ProductQueryRecord | null> {
    const product = await this.command.findBySku(sku);
    return product ? this.toRecord(product) : null;
  }

  public async findPurchasableById(id: string): Promise<ProductQueryRecord | null> {
    return this.findById(id);
  }

  public async findPurchasableByIds(ids: string[]): Promise<ProductQueryRecord[]> {
    const records = await Promise.all(ids.map(id => this.findById(id)));
    return records.filter((record): record is ProductQueryRecord => record !== null);
  }

  public async findPurchasableBySkus(skus: string[]): Promise<ProductQueryRecord[]> {
    const records = await Promise.all(skus.map(sku => this.findBySku(sku)));
    return records.filter((record): record is ProductQueryRecord => record !== null);
  }

  public async findAll(query: PageQuery): Promise<PageResult<ProductQueryRecord>> {
    const items = [...this.command.byId.values()].map(product => this.toRecord(product));
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

  private toRecord(product: Product): ProductQueryRecord {
    return {
      id: product.id.toString(),
      sku: product.sku,
      name: product.name,
      description: product.description,
      status: product.status,
      unitPrice: product.unitPrice.amount,
      currency: product.currency,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

describe('Product module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryProductCommandRepository;
  let outbox: RecordingOutboxWriter;

  async function build(platform: ComponentModuleOptions['platform'] = []): Promise<TestingModule> {
    command = new InMemoryProductCommandRepository();
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(ProductModule, {
      overrides: [
        { provide: ProductCommandRepository, useValue: command },
        { provide: ProductQuery, useValue: new InMemoryProductQuery(command) },
        { provide: OutboxWriterPort, useValue: outbox },
      ],
      platform: [...(platform ?? [])],
    });
    return moduleRef;
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resolves the command and query use cases from the container', async () => {
    await build();

    expect(moduleRef.get(CreateProductUseCase)).toBeInstanceOf(CreateProductUseCase);
    expect(moduleRef.get(GetProductUseCase)).toBeInstanceOf(GetProductUseCase);
    expect(moduleRef.get(ProductQuery)).toBeInstanceOf(InMemoryProductQuery);
  });

  it('exposes both public ports bound to their facades', async () => {
    await build();

    expect(moduleRef.get(ProductForPurchasePort)).toBeInstanceOf(ProductForPurchaseFacade);
    expect(moduleRef.get(ProductForSalesPort)).toBeDefined();
  });

  it('creates a product through the graph and emits one outbox event', async () => {
    await build();

    const id = await moduleRef
      .get(CreateProductUseCase)
      .execute({ sku: 'SKU-100', name: 'Widget', unitPrice: 12.5 });

    expect(command.byId.get(id)).toBeDefined();
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('Product');
    expect(outbox.appended[0].aggregateId).toBe(id);
  });

  it('normalizes the SKU before the uniqueness check sees it', async () => {
    await build();
    const useCase = moduleRef.get(CreateProductUseCase);
    await useCase.execute({ sku: 'SKU-100', name: 'Widget', unitPrice: 1 });

    await expect(
      useCase.execute({ sku: '  sku-100 ', name: 'Copy', unitPrice: 1 }),
    ).rejects.toThrow(ConflictException);
    expect(command.byId.size).toBe(1);
  });

  it('fails closed when ABAC denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef.get(CreateProductUseCase).execute({ sku: 'SKU-200', name: 'X', unitPrice: 1 }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('evaluates ABAC with the context identity, not caller-supplied identity', async () => {
    await build();
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef
      .get(CreateProductUseCase)
      .execute({ sku: 'SKU-300', name: 'Context', unitPrice: 2 });

    expect(abac.lastCheck().context.companyId).toBe(COMPONENT_CONTEXT.companyId);
    expect(abac.lastCheck().resource).toBe('Product');
  });
});
