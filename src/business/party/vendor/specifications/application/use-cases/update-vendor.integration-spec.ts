import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateVendorUseCase } from '@business/party/vendor/application/use-cases/update-vendor.usecase';
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

class InMemoryVendorRepository extends VendorCommandRepository {
  public readonly store = new Map<string, Vendor>();
  public readonly updates: Vendor[] = [];

  async findById(id: string): Promise<Vendor | null> {
    return this.store.get(id) ?? null;
  }
  async findByCode(): Promise<Vendor | null> {
    return null;
  }
  async save(vendor: Vendor): Promise<Vendor> {
    this.store.set(vendor.id.toString(), vendor);
    return vendor;
  }
  async update(vendor: Vendor): Promise<Vendor> {
    this.updates.push(vendor);
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

const defaultContext = {
  tenantId: 'tenant-1',
  companyId: 'company-1',
  userId: 'user-1',
  roles: ['admin'],
  defaultCurrency: 'USD',
};

function makeSut(opts?: { vendor?: Vendor; abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryVendorRepository();
  const vendor = opts?.vendor ?? VendorFactory.create({ code: 'VEN-100', name: 'Acme' });
  repo.store.set(vendor.id.toString(), vendor);

  const publisher = new InMemoryVendorPublisherPort();
  const ctx = new InMemoryRequestContextService(
    opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
  );
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new UpdateVendorUseCase(repo, publisher, ctx, abac);
  return { useCase, repo, publisher, ctx, vendor };
}

describe('UpdateVendorUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('updates the vendor name', async () => {
    const { useCase, repo, vendor } = makeSut();
    const id = await useCase.execute({ id: vendor.id.toString(), name: 'New Name' });
    expect(id).toBe(vendor.id.toString());
    expect(repo.updates).toHaveLength(1);
    expect(repo.updates[0].name).toBe('New Name');
  });

  it('updates email, phone and address', async () => {
    const { useCase, repo, vendor } = makeSut();
    await useCase.execute({
      id: vendor.id.toString(),
      name: 'Acme',
      email: 'new@acme.com',
      phone: '555',
      address: '1 Main St',
    });
    const updated = repo.updates[0];
    expect(updated.email).toBe('new@acme.com');
    expect(updated.phone).toBe('555');
    expect(updated.address).toBe('1 Main St');
  });

  it('raises a VendorUpdated event', async () => {
    const { useCase, publisher, vendor } = makeSut();
    await useCase.execute({ id: vendor.id.toString(), name: 'Acme' });
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the vendor does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing-id', name: 'Acme' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, vendor } = makeSut({ noCompany: true });
    await expect(useCase.execute({ id: vendor.id.toString(), name: 'Acme' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, vendor } = makeSut({ abacDeny: true });
    await expect(useCase.execute({ id: vendor.id.toString(), name: 'Acme' })).rejects.toThrow(
      ForbiddenException,
    );
  });
});
