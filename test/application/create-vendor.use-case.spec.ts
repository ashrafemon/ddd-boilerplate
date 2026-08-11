import { CreateVendorUseCase } from '../../src/business/vendor/application/use-case/create-vendor/create-vendor.use-case';
import { VendorBuilder } from '../../src/business/vendor/domain/service/vendor-builder.service';
import { VendorWriteRepositoryPort } from '../../src/business/vendor/domain/port/vendor-write-repository.port';
import { OutboxPort } from '../../src/shared-kernel/ports/outbox/outbox.port';
import { RequestContextPort } from '../../src/shared-kernel/ports/context/request-context.port';
import { ConflictException } from '../../src/shared-kernel/exceptions/conflict.exception';
import { UnauthorizedException } from '../../src/shared-kernel/exceptions/unauthorized.exception';

jest.mock('@nestjs-cls/transactional', () => ({
  ...jest.requireActual('@nestjs-cls/transactional'),
  Transactional: () => jest.fn(),
}));

describe('CreateVendorUseCase', () => {
  const requestContext: RequestContextPort = {
    isAvailable: () => true,
    get: () => null,
    require: () => {
      throw new Error('not used');
    },
    set: () => undefined,
    getRequestId: () => undefined,
    getCorrelationId: () => 'corr-1',
    getTenantId: () => 'tenant-1',
    getOrganizationId: () => 'org-1',
    getUserId: () => undefined,
  };

  function createUnit() {
    const writeRepository: VendorWriteRepositoryPort = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByCode: jest.fn().mockResolvedValue(null),
    };
    const outbox: OutboxPort = {
      append: jest.fn().mockResolvedValue(undefined),
      appendMany: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new CreateVendorUseCase(
      new VendorBuilder(),
      writeRepository,
      outbox,
      requestContext,
    );

    return { useCase, writeRepository, outbox };
  }

  it('creates a vendor and appends outbox events atomically', async () => {
    const { useCase, writeRepository, outbox } = createUnit();

    const result = await useCase.execute({
      code: 'V-0009',
      name: 'Test Vendor',
      email: 'vendor@test.example',
      bankAccounts: [{ accountName: 'Main', iban: 'DE89370400440532013000', currency: 'EUR' }],
    });

    expect(result.vendorId).toBeDefined();
    expect(writeRepository.save).toHaveBeenCalledTimes(1);
    expect(outbox.appendMany).toHaveBeenCalledTimes(1);
    const events = (outbox.appendMany as jest.Mock).mock.calls[0][0];
    expect(events[0].eventType).toBe('vendor.created');
    expect(events[0].tenantId).toBe('tenant-1');
    expect(events[0].organizationId).toBe('org-1');
    expect(events[0].correlationId).toBe('corr-1');
  });

  it('rejects duplicate vendor codes', async () => {
    const { useCase, writeRepository } = createUnit();
    (writeRepository.findByCode as jest.Mock).mockResolvedValue({ getId: () => ({ getValue: () => 'v-1' }) });

    await expect(
      useCase.execute({ code: 'V-0009', name: 'Test Vendor' }),
    ).rejects.toThrow(ConflictException);
  });

  it('requires tenant context', async () => {
    const noTenantContext: RequestContextPort = {
      isAvailable: () => true,
      get: () => null,
      require: () => {
        throw new Error('not used');
      },
      set: () => undefined,
      getRequestId: () => undefined,
      getCorrelationId: () => 'corr-1',
      getTenantId: () => undefined,
      getOrganizationId: () => 'org-1',
      getUserId: () => undefined,
    };
    const useCase = new CreateVendorUseCase(
      new VendorBuilder(),
      {
        save: jest.fn(),
        findById: jest.fn(),
        findByCode: jest.fn(),
      },
      { append: jest.fn(), appendMany: jest.fn() },
      noTenantContext,
    );

    await expect(useCase.execute({ code: 'V-0010', name: 'X' })).rejects.toThrow(UnauthorizedException);
  });
});
