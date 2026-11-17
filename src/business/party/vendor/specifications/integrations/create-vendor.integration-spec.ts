import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateVendorUseCase } from '@business/party/vendor/application/use-cases/create-vendor.usecase';
import { VendorCommandRepository } from '@business/party/vendor/domain/repositories/vendor-command.repository';
import { VendorPublisherPort } from '@business/party/vendor/application/publishes/publishers/vendor.publisher-port';
import { Vendor } from '@business/party/vendor/domain/aggregates/vendor.aggregate';
import { VendorFactory } from '@business/party/vendor/domain/factories/vendor.factory';
import { OutboxEvent } from '@platform/platform-common/outbox/outbox.types';
import {
  AbacPort,
  AbacResult,
  AbacCheck,
} from '@platform/platform-organization/authorization/ports/abac.port';
import { InMemoryRequestContextService } from '@test/support/context/in-memory-request-context';
import { initNoopTransactionHost } from '@test/utils/noop-transaction-host';

// ---- Fakes ----

class InMemoryVendorRepository extends VendorCommandRepository {
  public readonly saved: Vendor[] = [];
  public readonly existing: Map<string, Vendor> = new Map();

  async findById(id: string): Promise<Vendor | null> {
    return this.existing.get(id) ?? null;
  }
  async findByCode(code: string): Promise<Vendor | null> {
    return [...this.existing.values()].find(v => v.code === code) ?? null;
  }
  async save(vendor: Vendor): Promise<Vendor> {
    this.saved.push(vendor);
    this.existing.set(vendor.id.toString(), vendor);
    return vendor;
  }
  async update(vendor: Vendor): Promise<Vendor> {
    return vendor;
  }
}

class InMemoryVendorPublisherPort extends VendorPublisherPort {
  public readonly events: OutboxEvent[] = [];
  async send(event: OutboxEvent, _vendorId: string): Promise<void> {
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

// ---- Tests ----

describe('CreateVendorUseCase (integration)', () => {
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

  function makeSut(opts?: { existingVendor?: Vendor; abacDeny?: boolean; noCompany?: boolean }) {
    const repo = new InMemoryVendorRepository();
    if (opts?.existingVendor) {
      repo.existing.set(opts.existingVendor.id.toString(), opts.existingVendor);
    }
    const publisher = new InMemoryVendorPublisherPort();
    const ctx = new InMemoryRequestContextService(
      opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
    );
    const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
    const useCase = new CreateVendorUseCase(repo, publisher, ctx, abac);
    return { useCase, repo, publisher, ctx };
  }

  it('creates a vendor and persists it with outbox event', async () => {
    const { useCase, repo, publisher } = makeSut();
    const id = await useCase.execute({
      code: 'VEN-100',
      name: 'Acme Supplies',
      email: 'billing@acme.com',
    });
    expect(id).toBeTruthy();
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].code).toBe('VEN-100');
    expect(repo.saved[0].name).toBe('Acme Supplies');
    expect(publisher.events).toHaveLength(1);
  });

  it('creates vendor without email', async () => {
    const { useCase, repo } = makeSut();
    await useCase.execute({ code: 'VEN-200', name: 'Globex' });
    expect(repo.saved[0].email).toBeNull();
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase } = makeSut({ noCompany: true });
    await expect(useCase.execute({ code: 'VEN-100', name: 'Acme' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ code: 'VEN-100', name: 'Acme' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ConflictException when vendor code already exists', async () => {
    const { useCase: useCase1 } = makeSut();
    // First create
    await useCase1.execute({ code: 'VEN-100', name: 'Acme' });

    // Second create with same code
    const repo = new InMemoryVendorRepository();
    const publisher = new InMemoryVendorPublisherPort();
    const ctx = new InMemoryRequestContextService(defaultContext);
    const abac = new AllowAbacAdapter();
    // Pre-populate repo with existing vendor
    const existing = VendorFactory.create({ code: 'VEN-100', name: 'Acme' });
    repo.existing.set(existing.id.toString(), existing);

    const useCase2 = new CreateVendorUseCase(repo, publisher, ctx, abac);
    await expect(useCase2.execute({ code: 'VEN-100', name: 'Acme' })).rejects.toThrow(
      ConflictException,
    );
  });
});
