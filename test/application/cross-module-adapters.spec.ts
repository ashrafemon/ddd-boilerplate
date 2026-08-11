import { VendorLookupAdapter } from '../../src/business/purchase/infrastructure/outbound/vendor/vendor-lookup.adapter';
import { ProductLookupAdapter } from '../../src/business/purchase/infrastructure/outbound/product/product-lookup.adapter';
import { GetVendorPort } from '../../src/business/vendor/application/port/get-vendor.port';
import { GetProductPort } from '../../src/business/product/application/port/get-product.port';
import { ModulePortAccessor } from '../../src/shared-kernel/ports/module-port-accessor';

/**
 * Cross-module boundary tests: the purchase adapter must reach the vendor
 * module through the vendor's application PORT, mocked at the port level
 * (never by mocking the vendor's concrete use case).
 */
describe('Cross-module adapters (Purchase -> Vendor / Product)', () => {
  it('VendorLookupAdapter resolves the vendor application port and translates the contract', async () => {
    const getVendorPortMock: GetVendorPort = {
      execute: jest.fn().mockResolvedValue({
        id: 'vendor-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        code: 'V-0001',
        name: 'Acme',
        status: 'ACTIVE',
        email: null,
        phone: null,
        taxIdentifier: null,
        addresses: [],
      }),
    };

    const portAccessor = {
      resolve: jest.fn((port: unknown) => {
        expect(port).toBe(GetVendorPort);
        return getVendorPortMock;
      }),
    } as unknown as ModulePortAccessor;

    const adapter = new VendorLookupAdapter(portAccessor);
    const result = await adapter.findForPurchase({ vendorId: 'vendor-1' });

    expect(result).toEqual({
      vendorId: 'vendor-1',
      code: 'V-0001',
      name: 'Acme',
      status: 'ACTIVE',
      isActive: true,
    });
    expect(portAccessor.resolve).toHaveBeenCalledWith(GetVendorPort);
  });

  it('ProductLookupAdapter resolves the product application port', async () => {
    const getProductPortMock: GetProductPort = {
      execute: jest.fn().mockResolvedValue({
        id: 'product-1',
        tenantId: 'tenant-1',
        organizationId: 'org-1',
        code: 'P-0001',
        name: 'Widget',
        description: null,
        sku: 'SKU-1',
        unit: 'EA',
        status: 'ACTIVE',
        isPurchasable: true,
        isSellable: true,
        priceCents: 500,
        currency: 'USD',
        categoryId: null,
      }),
    };

    const portAccessor = {
      resolve: jest.fn((port: unknown) => {
        expect(port).toBe(GetProductPort);
        return getProductPortMock;
      }),
    } as unknown as ModulePortAccessor;

    const adapter = new ProductLookupAdapter(portAccessor);
    const result = await adapter.findForPurchase({ productId: 'product-1' });

    expect(result.productId).toBe('product-1');
    expect(result.priceCents).toBe(500);
    expect(result.isPurchasable).toBe(true);
    expect(portAccessor.resolve).toHaveBeenCalledWith(GetProductPort);
  });
});
