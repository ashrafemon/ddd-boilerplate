import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VendorStatusUseCase } from '@business/party/vendor/application/use-cases/vendor-status.usecase';
import { VendorCommandRepository } from '@business/party/vendor/domain/repositories/vendor-command.repository';
import { VendorPublisherPort } from '@business/party/vendor/application/publishes/publishers/vendor.publisher-port';
import { Vendor } from '@business/party/vendor/domain/aggregates/vendor.aggregate';
import { VendorFactory } from '@business/party/vendor/domain/factories/vendor.factory';
import { VendorStatus } from '@business/party/vendor/domain/types/vendor.enum';
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

function makeSut(opts?: { abacDeny?: boolean; noCompany?: boolean }) {
  const repo = new InMemoryVendorRepository();
  const vendor = VendorFactory.create({ code: 'VEN-100', name: 'Acme' });
  repo.store.set(vendor.id.toString(), vendor);

  const publisher = new InMemoryVendorPublisherPort();
  const ctx = new InMemoryRequestContextService(
    opts?.noCompany ? { tenantId: 't', userId: 'u', roles: [] } : defaultContext,
  );
  const abac = opts?.abacDeny ? new DenyAbacAdapter() : new AllowAbacAdapter();
  const useCase = new VendorStatusUseCase(repo, publisher, ctx, abac);
  return { useCase, repo, publisher, ctx, vendor };
}

describe('VendorStatusUseCase (integration)', () => {
  beforeAll(() => initNoopTransactionHost());

  it('deactivates an active vendor', async () => {
    const { useCase, repo, vendor } = makeSut();
    await useCase.execute({ id: vendor.id.toString(), action: 'deactivate' });
    expect(repo.updates[0].status).toBe(VendorStatus.INACTIVE);
  });

  it('blocks an active vendor', async () => {
    const { useCase, repo, vendor } = makeSut();
    await useCase.execute({ id: vendor.id.toString(), action: 'block' });
    expect(repo.updates[0].status).toBe(VendorStatus.BLOCKED);
  });

  it('reactivates a blocked vendor', async () => {
    const { useCase, repo, vendor } = makeSut();
    await useCase.execute({ id: vendor.id.toString(), action: 'block' });
    await useCase.execute({ id: vendor.id.toString(), action: 'activate' });
    expect(repo.updates[repo.updates.length - 1].status).toBe(VendorStatus.ACTIVE);
  });

  it('raises a domain event on transition', async () => {
    const { useCase, publisher, vendor } = makeSut();
    await useCase.execute({ id: vendor.id.toString(), action: 'deactivate' });
    expect(publisher.events.length).toBeGreaterThanOrEqual(1);
  });

  it('throws NotFoundException when the vendor does not exist', async () => {
    const { useCase } = makeSut();
    await expect(useCase.execute({ id: 'missing', action: 'deactivate' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when companyId is missing', async () => {
    const { useCase, vendor } = makeSut({ noCompany: true });
    await expect(
      useCase.execute({ id: vendor.id.toString(), action: 'deactivate' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when ABAC denies', async () => {
    const { useCase, vendor } = makeSut({ abacDeny: true });
    await expect(
      useCase.execute({ id: vendor.id.toString(), action: 'deactivate' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
