import { ForbiddenException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { InvoiceModule } from '@business/sales/invoice/invoice.module';
import { CreateInvoiceUseCase } from '@business/sales/invoice/application/use-cases/create-invoice.usecase';
import { GetInvoiceUseCase } from '@business/sales/invoice/application/use-cases/get-invoice.usecase';
import { PostInvoiceUseCase } from '@business/sales/invoice/application/use-cases/post-invoice.usecase';
import { InvoiceCommandRepository } from '@business/sales/invoice/domain/repositories/invoice-command.repository';
import { InvoiceQuery } from '@business/sales/invoice/application/queries/invoice.query';
import { InvoiceForReportsPort } from '@business/sales/invoice/public/ports/invoice-for-reports.port';
import { RecurringInvoiceGenerationPort } from '@business/sales/invoice/public/ports/recurring-invoice-generation.port';
import { InvoiceForReportsFacade } from '@business/sales/invoice/application/facades/invoice-for-reports.facade';
import { NumberingPort } from '@business/sales/invoice/application/outbound-ports/numbering.port';
import { Invoice } from '@business/sales/invoice/domain/aggregates/invoice.aggregate';
import { InvoiceQueryRecord } from '@business/sales/invoice/domain/types/invoice.types';
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
 * Invoice — component tests: the real `InvoiceModule` provider graph with every
 * IO edge faked.
 */

class InMemoryInvoiceCommandRepository extends InvoiceCommandRepository {
  public readonly byId = new Map<string, Invoice>();

  public async findById(id: string): Promise<Invoice | null> {
    return this.byId.get(id) ?? null;
  }

  public async save(invoice: Invoice): Promise<Invoice> {
    this.byId.set(invoice.id.toString(), invoice);
    return invoice;
  }

  public async update(invoice: Invoice): Promise<Invoice> {
    this.byId.set(invoice.id.toString(), invoice);
    return invoice;
  }
}

class InMemoryInvoiceQuery extends InvoiceQuery {
  constructor(private readonly command: InMemoryInvoiceCommandRepository) {
    super();
  }

  public async findById(id: string): Promise<InvoiceQueryRecord | null> {
    const invoice = await this.command.findById(id);
    return invoice ? (invoice as unknown as InvoiceQueryRecord) : null;
  }

  public async findAll(query: PageQuery): Promise<PageResult<InvoiceQueryRecord>> {
    const items = [...this.command.byId.values()] as unknown as InvoiceQueryRecord[];
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
}

class FakeNumberingPort extends NumberingPort {
  private seq = 0;

  public async nextNumber(
    sequenceKey: string,
    options?: { prefix?: string; padding?: number },
  ): Promise<string> {
    this.seq += 1;
    const padded = String(this.seq).padStart(options?.padding ?? 6, '0');
    return options?.prefix ? `${options.prefix}${padded}` : `${sequenceKey}-${padded}`;
  }
}

describe('Invoice module (component)', () => {
  let moduleRef: TestingModule;
  let command: InMemoryInvoiceCommandRepository;
  let outbox: RecordingOutboxWriter;

  async function build(platform: ComponentModuleOptions['platform'] = []): Promise<TestingModule> {
    command = new InMemoryInvoiceCommandRepository();
    outbox = new RecordingOutboxWriter();
    moduleRef = await createComponentModule(InvoiceModule, {
      overrides: [
        { provide: InvoiceCommandRepository, useValue: command },
        { provide: InvoiceQuery, useValue: new InMemoryInvoiceQuery(command) },
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

  it('resolves the command use cases from the container', async () => {
    await build();

    expect(moduleRef.get(CreateInvoiceUseCase)).toBeInstanceOf(CreateInvoiceUseCase);
    expect(moduleRef.get(PostInvoiceUseCase)).toBeInstanceOf(PostInvoiceUseCase);
    expect(moduleRef.get(GetInvoiceUseCase)).toBeInstanceOf(GetInvoiceUseCase);
  });

  it('binds both public ports to their facades', async () => {
    await build();

    expect(moduleRef.get(InvoiceForReportsPort)).toBeInstanceOf(InvoiceForReportsFacade);
    expect(moduleRef.get(RecurringInvoiceGenerationPort)).toBeDefined();
  });

  it('creates an invoice through the graph and emits one outbox event', async () => {
    await build();

    const id = await moduleRef.get(CreateInvoiceUseCase).execute({
      customerId: 'customer-1',
      currency: 'USD',
      lines: [{ description: 'Widget', quantity: 2, unitPrice: 10 }],
    });

    expect(command.byId.get(id)).toBeDefined();
    expect(outbox.appended).toHaveLength(1);
    expect(outbox.appended[0].aggregateType).toBe('Invoice');
    expect(outbox.appended[0].aggregateId).toBe(id);
  });

  it('fails closed when the platform ABAC double denies', async () => {
    await build([{ provide: AbacPort, useValue: new AllowAbacPort('DENY') }]);

    await expect(
      moduleRef.get(CreateInvoiceUseCase).execute({
        customerId: 'c',
        currency: 'USD',
        lines: [{ description: 'Widget', quantity: 1, unitPrice: 5 }],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(command.byId.size).toBe(0);
  });

  it('evaluates ABAC with the platform identity and resource', async () => {
    await build();
    const abac: AllowAbacPort = moduleRef.get(AbacPort);

    await moduleRef.get(CreateInvoiceUseCase).execute({
      customerId: 'c',
      currency: 'USD',
      lines: [{ description: 'Widget', quantity: 1, unitPrice: 5 }],
    });

    expect(abac.lastCheck().context.companyId).toBe(COMPONENT_CONTEXT.companyId);
    expect(abac.lastCheck().resource).toBe('Invoice');
    expect(abac.lastCheck().action).toBe('create');
  });
});
