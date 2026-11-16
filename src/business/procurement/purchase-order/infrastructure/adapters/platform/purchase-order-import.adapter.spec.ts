import { PurchaseOrderImportHandler } from './purchase-order-import.adapter';
import { ImportPurchaseOrderUseCase } from '../../../application/use-cases/import-purchase-order.usecase';
import { OrderableVendorPort } from '../../../application/outbound-ports/vendor-query.port';
import { PurchasableProductPort } from '../../../application/outbound-ports/product-query.port';

const rows = [
  {
    rowNumber: 1,
    poReference: 'PO-REF-1',
    vendorCode: 'v1',
    currency: 'usd',
    sku: 'sku-1',
    quantity: '2',
    unitPrice: '5.00',
  },
];

function makeHandler() {
  const vendors = { findOrderableVendorsByCodes: jest.fn() };
  const products = { findPurchasableProductsBySkus: jest.fn() };
  const importPurchaseOrder = { execute: jest.fn() };
  vendors.findOrderableVendorsByCodes.mockResolvedValue([{ id: 'v-1', code: 'V1' }]);
  products.findPurchasableProductsBySkus.mockResolvedValue([{ id: 'p-1', sku: 'SKU-1' }]);
  const handler = new PurchaseOrderImportHandler(
    vendors as unknown as OrderableVendorPort,
    products as unknown as PurchasableProductPort,
    importPurchaseOrder as unknown as ImportPurchaseOrderUseCase,
  );
  return { handler, vendors, products, importPurchaseOrder };
}

describe('PurchaseOrderImportHandler', () => {
  it('preloads vendors and products by code and sku', async () => {
    const { handler, vendors, products } = makeHandler();
    const refs = await handler.preloadReferences(rows);
    expect(vendors.findOrderableVendorsByCodes).toHaveBeenCalledWith(['V1']);
    expect(products.findPurchasableProductsBySkus).toHaveBeenCalledWith(['SKU-1']);
    expect(refs).toBeDefined();
  });

  it('validates a consistent row set', async () => {
    const { handler } = makeHandler();
    const refs = await handler.preloadReferences(rows);
    await expect(handler.validateBatch(rows, refs)).resolves.toEqual([
      { rowNumber: 1, status: 'VALID', errors: undefined },
    ]);
  });

  it('rejects unknown vendors and products', async () => {
    const { handler, vendors, products } = makeHandler();
    vendors.findOrderableVendorsByCodes.mockResolvedValue([]);
    products.findPurchasableProductsBySkus.mockResolvedValue([]);
    const refs = await handler.preloadReferences(rows);
    const verdicts = await handler.validateBatch(rows, refs);
    expect(verdicts[0].status).toBe('INVALID');
    expect(verdicts[0].errors).toEqual(
      expect.arrayContaining([
        "vendor 'V1' not found or not orderable",
        "product 'SKU-1' not found or not purchasable",
      ]),
    );
  });

  it('rejects duplicate skus within one purchase order', async () => {
    const { handler } = makeHandler();
    const duplicate = [...rows, { ...rows[0], rowNumber: 2 }];
    const refs = await handler.preloadReferences(duplicate);
    const verdicts = await handler.validateBatch(duplicate, refs);
    expect(verdicts[1].status).toBe('INVALID');
    expect(verdicts[1].errors).toContain("duplicate sku 'SKU-1' for poReference 'PO-REF-1'");
  });

  it('executes grouped rows through the import use case', async () => {
    const { handler, importPurchaseOrder } = makeHandler();
    importPurchaseOrder.execute.mockResolvedValue({ toString: () => 'po-1' });
    const results = await handler.executeBatch(rows);
    expect(importPurchaseOrder.execute).toHaveBeenCalledWith({
      externalReference: 'PO-REF-1',
      vendorId: 'v-1',
      currency: 'USD',
      lines: [{ productId: 'p-1', quantity: 2, unitPrice: 5 }],
    });
    expect(results).toEqual([{ rowNumber: 1, status: 'APPLIED', entityId: 'po-1' }]);
  });

  it('reports failures when the import use case rejects', async () => {
    const { handler, importPurchaseOrder } = makeHandler();
    importPurchaseOrder.execute.mockRejectedValue(new Error('conflict'));
    const results = await handler.executeBatch(rows);
    expect(results[0]).toMatchObject({ status: 'FAILED', errorMessage: 'conflict' });
  });
});
