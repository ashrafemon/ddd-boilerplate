import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { CreateVendorUseCase } from '@business/party/vendor/application/use-cases/create-vendor.usecase';
import { VendorForPurchaseFacade } from '@business/party/vendor/application/facades/vendor-for-purchase.facade';
import { VendorForPurchasePort } from '@business/party/vendor/public/ports/vendor-for-purchase.port';
import { VendorCommandRepository } from '@business/party/vendor/domain/repositories/vendor-command.repository';
import { VendorQuery } from '@business/party/vendor/application/queries/vendor.query';
import { VendorModule } from '@business/party/vendor/vendor.module';
import { Vendor } from '@business/party/vendor/domain/aggregates/vendor.aggregate';
import { PageQuery, PageResult } from '@common/application/types/pagination';
import { VendorQueryRecord } from '@business/party/vendor/domain/types/vendor.types';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { OutboxWriterPort } from '@platform/platform-common/outbox/ports/outbox-writer.port';
import { ComponentModuleOptions, createComponentModule } from '@test/utils/component-module';
import {
  AllowAbacPort,
  COMPONENT_CONTEXT,
  RecordingOutboxWriter,
} from '@test/support/platform/fake-platform-ports';

/**
 * Vendor — component tests.
 *
 * The subject is the wiring: `VendorModule`'s real provider list is replayed
 * into a Nest testing module with every IO edge faked, so a missing `provide`
 * token, a broken `useExisting`/`useFactory` binding or a constructor that
 * injects an unbound port fails here. Behaviour through that graph is asserted
 * with in-memory repositories and a recording outbox.
 */

class InMemoryVendorCommandRepository extends VendorCommandRepository {
  public readonly byId = new Map<string, Vendor>();

  public async findById(id: string): Promise<Vendor | null> {
    return this.byId.get(id) ?? null;
  }

  public async findByCode(code: string): Promise<Vendor | null> {
    return [...this.byId.values()].find(vendor => vendor.code === code) ?? null;
  }

  public async save(vendor: Vendor): Promise<Vendor> {
    this.byId.set(vendor.id.toString(), vendor);
    return vendor;
  }

  public async update(vendor: Vendor): Promise<Vendor> {
    this.byId.set(vendor.id.toString(), vendor);
    return vendor;
  }
}

class InMemoryVendorQuery extends VendorQuery {
  constructor(private readonly command: InMemoryVendorCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<VendorQueryRecord | null> {
    const vendor = await this.command.findById(id);
    return vendor ? this.toRecord(vendor) : null;
  }

  public async findOrderableById(id: string): Promise<VendorQueryRecord | null> {
    return this.findById(id);
  }

  public async findOrderableByCodes(codes: string[]): Promise<VendorQueryRecord[]> {
    const all = [...this.command.byId.values()].map(vendor => this.toRecord(vendor));
    return all.filter(record => codes.includes(record.code));
  }

  public async findAll(query: PageQuery): Promise<PageResult<VendorQueryRecord>> {
    const items = [...this.command.byId.values()].map(vendor => this.toRecord(vendor));
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

  private toRecord(vendor: Vendor): VendorQueryRecord {
    return {
      id: vendor.id.toString(),
      code: vendor.code,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      status: vendor.status,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    };
  }
}

describe('Vendor module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryVendorCommandRepository;
  let outbox: RecordingOutboxWriter;

  async function build(platform: ComponentModuleOptions['platform'] = []) {
    command = new InMemoryVendorCommandRepository();
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(VendorModule, {
      overrides: [
        { provide: VendorCommandRepository, useValue: command },
        { provide: VendorQuery, useValue: new InMemoryVendorQuery(command) },
        { provide: OutboxWriterPort, useValue: outbox },
      ],
      platform: [...(platform ?? [])],
    });
    return moduleRef;
  }

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resolves the whole declared provider graph', async () => {
    await build();

    expect(moduleRef.get(CreateVendorUseCase)).toBeInstanceOf(CreateVendorUseCase);
    expect(moduleRef.get(VendorQuery)).toBeInstanceOf(InMemoryVendorQuery);
    expect(moduleRef.get(VendorCommandRepository)).toBeInstanceOf(InMemoryVendorCommandRepository);
  });

  it('binds the public VendorForPurchasePort to its facade via useExisting', async () => {
    await build();

    expect(moduleRef.get(VendorForPurchasePort)).toBeInstanceOf(VendorForPurchaseFacade);
  });

  it('keeps the documented module surface — no extra public port leaks', async () => {
    await build();

    expect(moduleRef.get(VendorForPurchasePort)).toBe(moduleRef.get(VendorForPurchaseFacade));
  });

  it('creates a vendor through the container and writes one outbox event', async () => {
    await build();
    const useCase = moduleRef.get(CreateVendorUseCase);

    const id = await useCase.execute({ code: 'VEN-100', name: 'Acme Supplies' });

    expect(command.byId.get(id)).toBeDefined();
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('Vendor');
    expect(outbox.appended[0].aggregateId).toBe(id);
    expect(outbox.appended[0].opts?.broker ?? 'rabbitmq').toBe('rabbitmq');
  });

  it('rejects a duplicate code reached through the wired repository', async () => {
    await build();
    const useCase = moduleRef.get(CreateVendorUseCase);
    await useCase.execute({ code: 'VEN-100', name: 'Acme Supplies' });

    await expect(useCase.execute({ code: 'VEN-100', name: 'Other' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('fails closed when the platform ABAC double denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef.get(CreateVendorUseCase).execute({ code: 'VEN-200', name: 'Blocked' }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('reads the identity from the platform request context, not from the input', async () => {
    await build([
      {
        provide: AbacPort,
        useValue: new AllowAbacPort('ALLOW'),
      },
    ]);
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef.get(CreateVendorUseCase).execute({ code: 'VEN-300', name: 'Context Co' });

    expect(abac.checks).toHaveLength(1);
    expect(abac.lastCheck().context.tenantId).toBe(COMPONENT_CONTEXT.tenantId);
    expect(abac.lastCheck().context.companyId).toBe(COMPONENT_CONTEXT.companyId);
    expect(abac.lastCheck().resource).toBe('Vendor');
    expect(abac.lastCheck().action).toBe('create');
  });
});
