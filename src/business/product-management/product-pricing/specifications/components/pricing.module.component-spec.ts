import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { PricingModule } from '@business/product-management/product-pricing/pricing.module';
import { CreatePriceListUseCase } from '@business/product-management/product-pricing/application/use-cases/create-price-list.usecase';
import { GetProductPriceUseCase } from '@business/product-management/product-pricing/application/use-cases/get-product-price.usecase';
import { PriceListCommandRepository } from '@business/product-management/product-pricing/domain/repositories/price-list-command.repository';
import { PriceListQuery } from '@business/product-management/product-pricing/application/queries/price-list.query';
import { ProductPriceQueryPort } from '@business/product-management/product-pricing/application/outbound-ports/product-price-query.port';
import { PriceList } from '@business/product-management/product-pricing/domain/aggregates/price-list.aggregate';
import { PriceListQueryRecord } from '@business/product-management/product-pricing/domain/types/price-list.types';
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
 * Product pricing — component tests: the real `PricingModule` provider graph
 * with in-memory repositories, a recording outbox and a platform context.
 */

class InMemoryPriceListCommandRepository extends PriceListCommandRepository {
  public readonly byId = new Map<string, PriceList>();

  public async findById(id: string): Promise<PriceList | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByCode(code: string): Promise<PriceList | null> {
    return [...this.byId.values()].find(list => list.code === code.trim().toUpperCase()) ?? null;
  }

  public async save(priceList: PriceList): Promise<PriceList> {
    this.byId.set(priceList.id.toString(), priceList);
    return priceList;
  }

  public async update(priceList: PriceList): Promise<PriceList> {
    this.byId.set(priceList.id.toString(), priceList);
    return priceList;
  }
}

class InMemoryPriceListQuery extends PriceListQuery {
  constructor(private readonly command: InMemoryPriceListCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<PriceListQueryRecord | null> {
    const list = await this.command.findById(id);
    return list ? this.toRecord(list) : null;
  }

  public async findByCode(code: string): Promise<PriceListQueryRecord | null> {
    const list = await this.command.findByCode(code);
    return list ? this.toRecord(list) : null;
  }

  public async findActiveByCode(code: string): Promise<PriceListQueryRecord | null> {
    return this.findByCode(code);
  }

  public async findPurchasablePriceForProduct(): Promise<null> {
    return null;
  }

  public async findAll(query: PageQuery): Promise<PageResult<PriceListQueryRecord>> {
    const items = [...this.command.byId.values()].map(list => this.toRecord(list));
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

  private toRecord(list: PriceList): PriceListQueryRecord {
    return {
      id: list.id.toString(),
      name: list.name,
      code: list.code,
      currency: list.currency,
      effectiveFrom: list.effectiveFrom,
      effectiveTo: list.effectiveTo ?? null,
      status: list.status,
      tenantId: null,
      companyId: COMPONENT_CONTEXT.companyId,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
  }
}

describe('Pricing module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryPriceListCommandRepository;
  let outbox: RecordingOutboxWriter;

  async function build(platform: ComponentModuleOptions['platform'] = []): Promise<TestingModule> {
    command = new InMemoryPriceListCommandRepository();
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(PricingModule, {
      overrides: [
        { provide: PriceListCommandRepository, useValue: command },
        { provide: PriceListQuery, useValue: new InMemoryPriceListQuery(command) },
        { provide: ProductPriceQueryPort, useValue: new InMemoryPriceListQuery(command) },
        { provide: OutboxWriterPort, useValue: outbox },
      ],
      platform: [...(platform ?? [])],
    });
    return moduleRef;
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resolves the module use cases from the container', async () => {
    await build();

    expect(moduleRef.get(CreatePriceListUseCase)).toBeInstanceOf(CreatePriceListUseCase);
    expect(moduleRef.get(GetProductPriceUseCase)).toBeInstanceOf(GetProductPriceUseCase);
  });

  it('exposes the public ProductPriceQueryPort', async () => {
    await build();
    expect(moduleRef.get(ProductPriceQueryPort)).toBeDefined();
  });

  it('creates a price list emitted through the outbox factory binding', async () => {
    await build();

    const id = await moduleRef.get(CreatePriceListUseCase).execute({
      name: 'Standard Price List',
      code: 'STD',
      currency: 'USD',
      effectiveFrom: '2025-01-01',
    });

    expect(command.byId.get(id)).toBeDefined();
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('PriceList');
    expect(outbox.appended[0].aggregateId).toBe(id);
  });

  it('rejects a duplicate price-list code reached through the wired repository', async () => {
    await build();
    const useCase = moduleRef.get(CreatePriceListUseCase);
    await useCase.execute({
      name: 'A',
      code: 'STD',
      currency: 'USD',
      effectiveFrom: '2025-01-01',
    });

    await expect(
      useCase.execute({ name: 'B', code: 'STD', currency: 'USD', effectiveFrom: '2025-02-01' }),
    ).rejects.toThrow(ConflictException);
    expect(command.byId.size).toBe(1);
  });

  it('fails closed when the platform ABAC double denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef
        .get(CreatePriceListUseCase)
        .execute({ name: 'X', code: 'NOPE', currency: 'USD', effectiveFrom: '2025-01-01' }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('evaluates ABAC with the platform identity and resource', async () => {
    await build();
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef
      .get(CreatePriceListUseCase)
      .execute({ name: 'Y', code: 'YES', currency: 'USD', effectiveFrom: '2025-01-01' });

    expect(abac.lastCheck().context.tenantId).toBe(COMPONENT_CONTEXT.tenantId);
    expect(abac.lastCheck().resource).toBe('PriceList');
    expect(abac.lastCheck().action).toBe('create');
  });
});
