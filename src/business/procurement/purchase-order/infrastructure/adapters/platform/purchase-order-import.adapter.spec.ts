import { ProductReference } from '@business/procurement/product/public';
import { VendorReference } from '@business/party/vendor/public';
import { OrderableVendorPort } from '../../../application/outbound-ports/vendor-query.port';
import { PurchasableProductPort } from '../../../application/outbound-ports/product-query.port';
import {
  ImportPurchaseOrderRequest,
  ImportPurchaseOrderUseCase,
} from '../../../application/usecases/import-purchase-order.usecase';
import { PurchaseOrderId } from '../../../domain/value-objects/purchase-order-id.vo';
import {
  PURCHASE_ORDER_IMPORT_DESCRIPTOR,
  PurchaseOrderImportHandler,
} from './purchase-order-import.adapter';

// The use case imports @Transactional; it is faked below, but the import must still load.
jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

const vendor = (id: string, code: string) => ({ id, code, status: 'ACTIVE' }) as VendorReference;
const product = (id: string, sku: string) => ({ id, sku, status: 'ACTIVE' }) as ProductReference;

function build(opts: { failReference?: string } = {}) {
  const calls: ImportPurchaseOrderRequest[] = [];
  const lookups = { vendors: [] as string[][], skus: [] as string[][] };

  const vendors: OrderableVendorPort = {
    getOrderableVendor: () => Promise.resolve(null),
    findOrderableVendorsByCodes: codes => {
      lookups.vendors.push(codes);
      return Promise.resolve(
        [vendor('v-acme', 'ACME'), vendor('v-globex', 'GLOBEX')].filter(v =>
          codes.includes(v.code),
        ),
      );
    },
  };
  const products: PurchasableProductPort = {
    getPurchasableProduct: () => Promise.resolve(null),
    findPurchasableProductsBySkus: skus => {
      lookups.skus.push(skus);
      return Promise.resolve(
        [product('p-1', 'SKU-1'), product('p-2', 'SKU-2')].filter(p => skus.includes(p.sku)),
      );
    },
  };
  const useCase = {
    execute: (req: ImportPurchaseOrderRequest) => {
      calls.push(req);
      if (req.externalReference === opts.failReference) {
        return Promise.reject(new Error('Purchase order cannot be edited'));
      }
      return Promise.resolve({ toString: () => `po-${req.externalReference}` } as PurchaseOrderId);
    },
  } as unknown as ImportPurchaseOrderUseCase;

  return { handler: new PurchaseOrderImportHandler(vendors, products, useCase), calls, lookups };
}

const row = (rowNumber: number, overrides: Record<string, string | undefined> = {}) => ({
  rowNumber,
  poReference: 'PO-A',
  vendorCode: 'acme',
  sku: 'sku-1',
  quantity: '2',
  unitPrice: '10.50',
  ...overrides,
});

describe('PurchaseOrderImportHandler', () => {
  describe('descriptor', () => {
    it('declares the file contract with a poReference+sku natural key', () => {
      expect(PURCHASE_ORDER_IMPORT_DESCRIPTOR.entityKey).toBe('purchase-order');
      const required = PURCHASE_ORDER_IMPORT_DESCRIPTOR.fields
        .filter(f => f.required)
        .map(f => f.targetField);
      expect(required).toEqual(['poReference', 'vendorCode', 'sku', 'quantity', 'unitPrice']);
      expect(PURCHASE_ORDER_IMPORT_DESCRIPTOR.upsertKeys).toEqual([['poReference', 'sku']]);
    });
  });

  describe('preloadReferences', () => {
    it('does one lookup per reference type with distinct normalised keys', async () => {
      const { handler, lookups } = build();
      await handler.preloadReferences([
        row(1),
        row(2, { sku: 'SKU-2' }),
        row(3, { vendorCode: ' Acme ' }),
      ]);
      expect(lookups.vendors).toEqual([['ACME']]);
      expect(lookups.skus).toEqual([['SKU-1', 'SKU-2']]);
    });
  });

  describe('validateBatch', () => {
    const validate = async (rows: ReturnType<typeof row>[]) => {
      const { handler } = build();
      const refs = await handler.preloadReferences(rows);
      return handler.validateBatch(rows, refs);
    };

    it('accepts well-formed rows (case/whitespace-insensitive codes)', async () => {
      const verdicts = await validate([row(1), row(2, { sku: ' SKU-2 ', vendorCode: 'Acme' })]);
      expect(verdicts.map(v => v.status)).toEqual(['VALID', 'VALID']);
    });

    it('rejects bad quantity, price and currency with a per-row message', async () => {
      const verdicts = await validate([
        row(1, { quantity: '0' }),
        row(2, { quantity: '1.5' }),
        row(3, { unitPrice: '-1' }),
        row(4, { unitPrice: '1.999' }),
        row(5, { currency: 'US' }),
      ]);
      expect(verdicts.every(v => v.status === 'INVALID')).toBe(true);
      expect(verdicts[0].errors?.[0]).toMatch(/quantity/);
      expect(verdicts[2].errors?.[0]).toMatch(/unitPrice/);
      expect(verdicts[4].errors?.[0]).toMatch(/currency/);
    });

    it('flags unknown vendor and unknown product', async () => {
      const verdicts = await validate([row(1, { vendorCode: 'NOPE' }), row(2, { sku: 'NOPE' })]);
      expect(verdicts[0].errors).toEqual(["vendor 'NOPE' not found or not orderable"]);
      expect(verdicts[1].errors).toEqual(["product 'NOPE' not found or not purchasable"]);
    });

    it('flags a row whose vendor or currency disagrees with its PO group', async () => {
      const verdicts = await validate([
        row(1, { currency: 'USD' }),
        row(2, { sku: 'SKU-2', vendorCode: 'GLOBEX' }),
        row(3, { sku: 'SKU-2', currency: 'EUR' }),
      ]);
      expect(verdicts.map(v => v.status)).toEqual(['VALID', 'INVALID', 'INVALID']);
      expect(verdicts[1].errors?.[0]).toMatch(/vendorCode differs/);
      expect(verdicts[2].errors?.[0]).toMatch(/currency differs/);
    });

    it('does not let an invalid first row poison valid siblings', async () => {
      const verdicts = await validate([
        row(1, { vendorCode: 'NOPE' }),
        row(2, { vendorCode: 'GLOBEX' }),
      ]);
      expect(verdicts.map(v => v.status)).toEqual(['INVALID', 'VALID']);
    });

    it('flags a repeated sku within the same PO but not across POs', async () => {
      const verdicts = await validate([row(1), row(2), row(3, { poReference: 'PO-B' })]);
      expect(verdicts.map(v => v.status)).toEqual(['VALID', 'INVALID', 'VALID']);
      expect(verdicts[1].errors?.[0]).toMatch(/duplicate sku/);
    });
  });

  describe('executeBatch', () => {
    it('creates one PO per poReference with all its lines, resolved to ids', async () => {
      const { handler, calls } = build();
      const results = await handler.executeBatch([
        row(1, { currency: 'usd' }),
        row(2, { poReference: 'PO-B', vendorCode: 'GLOBEX' }),
        row(3, { sku: 'SKU-2', quantity: '4' }),
      ]);

      expect(calls).toEqual([
        {
          externalReference: 'PO-A',
          vendorId: 'v-acme',
          currency: 'USD',
          lines: [
            { productId: 'p-1', quantity: 2, unitPrice: 10.5 },
            { productId: 'p-2', quantity: 4, unitPrice: 10.5 },
          ],
        },
        {
          externalReference: 'PO-B',
          vendorId: 'v-globex',
          currency: undefined,
          lines: [{ productId: 'p-1', quantity: 2, unitPrice: 10.5 }],
        },
      ]);
      expect(results).toEqual(
        expect.arrayContaining([
          { rowNumber: 1, status: 'APPLIED', entityId: 'po-PO-A' },
          { rowNumber: 3, status: 'APPLIED', entityId: 'po-PO-A' },
          { rowNumber: 2, status: 'APPLIED', entityId: 'po-PO-B' },
        ]),
      );
    });

    it('fails every row of a PO whose use case throws, and still applies the others', async () => {
      const { handler } = build({ failReference: 'PO-A' });
      const results = await handler.executeBatch([row(1), row(2, { poReference: 'PO-B' })]);
      const byRow = new Map(results.map(r => [r.rowNumber, r]));
      expect(byRow.get(1)?.status).toBe('FAILED');
      expect(byRow.get(1)?.errorMessage).toContain('cannot be edited');
      expect(byRow.get(2)?.status).toBe('APPLIED');
    });

    it('fails rows that went stale since validation without calling the use case', async () => {
      const { handler, calls } = build();
      const results = await handler.executeBatch([row(1, { sku: 'GONE' })]);
      expect(calls).toHaveLength(0);
      expect(results).toEqual([
        {
          rowNumber: 1,
          status: 'FAILED',
          errorMessage: "product 'GONE' not found or not purchasable",
        },
      ]);
    });

    it('answers every row exactly once', async () => {
      const { handler } = build();
      const rows = [
        row(1),
        row(2, { sku: 'SKU-2' }),
        row(3, { vendorCode: 'GLOBEX' }),
        row(4, { quantity: 'x' }),
      ];
      const results = await handler.executeBatch(rows);
      expect(results.map(r => r.rowNumber).sort()).toEqual([1, 2, 3, 4]);
    });
  });
});
