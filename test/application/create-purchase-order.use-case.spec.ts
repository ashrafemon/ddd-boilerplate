import { CreatePurchaseOrderUseCase } from '../../src/business/purchase/application/use-case/create-purchase-order/create-purchase-order.use-case';
import { PurchaseOrderBuilder } from '../../src/business/purchase/domain/service/purchase-order-builder.service';
import { PurchaseOrderWriteRepositoryPort } from '../../src/business/purchase/domain/port/purchase-order-write-repository.port';
import { VendorLookupPort } from '../../src/business/purchase/domain/port/vendor-lookup.port';
import { ProductLookupPort } from '../../src/business/purchase/domain/port/product-lookup.port';
import { PurchaseOrganizationConfigurationPort } from '../../src/business/purchase/domain/port/purchase-organization-configuration.port';
import { DocumentNumberGeneratorPort } from '../../src/business/purchase/domain/port/document-number-generator.port';
import { OutboxPort } from '../../src/shared-kernel/ports/outbox/outbox.port';
import { RequestContextPort } from '../../src/shared-kernel/ports/context/request-context.port';
import { PolicyViolationException } from '../../src/shared-kernel/exceptions/policy-violation.exception';

jest.mock('@nestjs-cls/transactional', () => ({
  ...jest.requireActual('@nestjs-cls/transactional'),
  Transactional: () => jest.fn(),
}));

describe('CreatePurchaseOrderUseCase (cross-module through ports)', () => {
  const requestContext: RequestContextPort = {
    isAvailable: () => true,
    get: () => null,
    require: () => {
      throw new Error('not used');
    },
    set: () => undefined,
    getRequestId: () => undefined,
    getCorrelationId: () => 'corr-po',
    getTenantId: () => 'tenant-1',
    getOrganizationId: () => 'org-1',
    getUserId: () => 'user-1',
  };

  // Mocks of the PURCHASE-OWNED ports. The vendor/product contexts are
  // deliberately not touched: only their capabilities (ports) are mocked.
  const vendorLookup: VendorLookupPort = {
    findForPurchase: jest.fn().mockResolvedValue({
      vendorId: 'vendor-1',
      code: 'V-0001',
      name: 'Acme',
      status: 'ACTIVE',
      isActive: true,
    }),
  };

  const productLookup: ProductLookupPort = {
    findForPurchase: jest.fn().mockResolvedValue({
      productId: 'product-1',
      code: 'P-0001',
      sku: 'SKU-1',
      name: 'Widget',
      unit: 'EA',
      status: 'ACTIVE',
      isActive: true,
      isPurchasable: true,
      priceCents: 500,
      currency: 'USD',
    }),
  };

  const organizationConfiguration: PurchaseOrganizationConfigurationPort = {
    getForOrganization: jest.fn().mockResolvedValue({
      approvalLimitCents: 1_000_000,
      requiresAdditionalApprovalLimitCents: 5_000_000,
      numberingPrefix: 'PO',
      nextSequence: 1,
    }),
  };

  const numberGenerator: DocumentNumberGeneratorPort = {
    generate: jest.fn().mockResolvedValue('PO-TEST-0001'),
  };

  function createUnit() {
    const writeRepository: PurchaseOrderWriteRepositoryPort = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
    };
    const outbox: OutboxPort = {
      append: jest.fn().mockResolvedValue(undefined),
      appendMany: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new CreatePurchaseOrderUseCase(
      new PurchaseOrderBuilder(),
      writeRepository,
      vendorLookup,
      productLookup,
      organizationConfiguration,
      numberGenerator,
      outbox,
      requestContext,
    );

    return { useCase, writeRepository, outbox };
  }

  it('builds and persists an order using vendor/product data from ports', async () => {
    const { useCase, writeRepository, outbox } = createUnit();

    const result = await useCase.execute({
      vendorId: 'vendor-1',
      currency: 'USD',
      notes: 'First order',
      lines: [{ productId: 'product-1', quantity: 10, taxRateBps: 100 }],
    });

    expect(result.number).toBe('PO-TEST-0001');
    expect(vendorLookup.findForPurchase).toHaveBeenCalledWith({ vendorId: 'vendor-1' });
    expect(productLookup.findForPurchase).toHaveBeenCalledWith({ productId: 'product-1' });

    const saved = (writeRepository.save as jest.Mock).mock.calls[0][0];
    expect(saved.totalCents).toBe(5050); // 10 * $5.00 + 1% tax

    const events = (outbox.appendMany as jest.Mock).mock.calls[0][0];
    expect(events[0].eventType).toBe('purchase.order.created');
    expect(events[0].tenantId).toBe('tenant-1');
  });

  it('enforces the product purchasability policy through the port data', async () => {
    const { useCase } = createUnit();
    (productLookup.findForPurchase as jest.Mock).mockResolvedValueOnce({
      productId: 'product-1',
      code: 'P-0001',
      sku: 'SKU-1',
      name: 'Widget',
      unit: 'EA',
      status: 'ACTIVE',
      isActive: true,
      isPurchasable: false,
      priceCents: 500,
      currency: 'USD',
    });

    await expect(
      useCase.execute({
        vendorId: 'vendor-1',
        lines: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).rejects.toThrow(PolicyViolationException);
  });

  it('enforces the vendor selection policy through the port data', async () => {
    const { useCase } = createUnit();
    (vendorLookup.findForPurchase as jest.Mock).mockResolvedValueOnce({
      vendorId: 'vendor-1',
      code: 'V-0001',
      name: 'Acme',
      status: 'INACTIVE',
      isActive: false,
    });

    await expect(
      useCase.execute({
        vendorId: 'vendor-1',
        lines: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).rejects.toThrow(PolicyViolationException);
  });
});
