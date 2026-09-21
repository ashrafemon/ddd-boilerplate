import { Injectable } from '@nestjs/common';
import { FailureMessage } from '@shared-kernel/utils/failure-message.util';
import { ImportHandler } from '@platform/import/ports/import-handler.port';
import {
  ImportDescriptor,
  PreloadedReferences,
  RowResult,
  RowVerdict,
} from '@platform/import/import.types';
import { ProductReference } from '@business/procurement/product/public';
import { VendorReference } from '@business/party/vendor/public';
import { ImportPurchaseOrderUseCase } from '../../../application/usecases/import-purchase-order.usecase';
import { OrderableVendorPort } from '../../../application/outbound-ports/vendor-query.port';
import { PurchasableProductPort } from '../../../application/outbound-ports/product-query.port';

const MAX_INT32 = 2_147_483_647;

/**
 * Flat file, ONE ROW PER PO LINE: rows sharing a `poReference` form one draft purchase
 * order. `poReference` is stored on the PO (`externalReference`), which is what makes
 * groups that straddle execution chunks — and re-imports of a corrected file — converge
 * on the same PO instead of creating duplicates.
 */
export const PURCHASE_ORDER_IMPORT_DESCRIPTOR: ImportDescriptor = {
  entityKey: 'purchase-order',
  version: 1,
  fields: [
    {
      targetField: 'poReference',
      dataType: 'string',
      required: true,
      aliases: ['PO Reference', 'po_reference', 'PO Ref', 'External Reference', 'Reference'],
      i18nKey: 'purchaseOrder.import.poReference',
      maxLength: 128,
    },
    {
      targetField: 'vendorCode',
      dataType: 'string',
      required: true,
      aliases: ['Vendor Code', 'vendor_code', 'Vendor'],
      i18nKey: 'purchaseOrder.import.vendorCode',
      maxLength: 32,
    },
    {
      targetField: 'currency',
      dataType: 'string',
      required: false,
      aliases: ['Currency', 'Curr'],
      i18nKey: 'purchaseOrder.import.currency',
      maxLength: 3,
    },
    {
      targetField: 'sku',
      dataType: 'string',
      required: true,
      aliases: ['SKU', 'Product SKU', 'Product Code', 'Item Code'],
      i18nKey: 'purchaseOrder.import.sku',
      maxLength: 64,
    },
    {
      targetField: 'quantity',
      dataType: 'integer',
      required: true,
      aliases: ['Quantity', 'Qty', 'Order Qty'],
      i18nKey: 'purchaseOrder.import.quantity',
      maxLength: 10,
    },
    {
      targetField: 'unitPrice',
      dataType: 'decimal',
      required: true,
      aliases: ['Unit Price', 'unit_price', 'Price', 'Rate'],
      i18nKey: 'purchaseOrder.import.unitPrice',
      maxLength: 20,
    },
  ],
  upsertKeys: [['poReference', 'sku']],
  maxRows: 10_000,
  maxFileSizeBytes: 10 * 1024 * 1024,
  executionChunkSize: 100,
};

type PurchaseOrderImportRow = {
  rowNumber: number;
  poReference?: string;
  vendorCode?: string;
  currency?: string;
  sku?: string;
  quantity?: string;
  unitPrice?: string;
};

/** Trimmed, normalised row; `errors` lists format problems (independent of reference data). */
interface ParsedRow {
  rowNumber: number;
  poReference: string;
  vendorCode: string;
  currency?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  errors: string[];
}

interface ResolvedReferences {
  vendors: Map<string, VendorReference>;
  products: Map<string, ProductReference>;
}

interface PoGroup {
  vendor: VendorReference;
  currency?: string;
  rows: ParsedRow[];
  lines: { productId: string; quantity: number; unitPrice: number }[];
}

function parseRow(row: PurchaseOrderImportRow): ParsedRow {
  const errors: string[] = [];
  const poReference = row.poReference?.trim() ?? '';
  const vendorCode = (row.vendorCode?.trim() ?? '').toUpperCase();
  const sku = (row.sku?.trim() ?? '').toUpperCase();
  const currency = row.currency?.trim().toUpperCase() || undefined;
  const quantityText = row.quantity?.trim() ?? '';
  const priceText = row.unitPrice?.trim() ?? '';

  if (!poReference) errors.push('poReference is required');
  if (!vendorCode) errors.push('vendorCode is required');
  if (!sku) errors.push('sku is required');
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.push('currency must be a 3-letter code');

  const quantity = Number(quantityText);
  if (!/^\d+$/.test(quantityText) || quantity < 1 || quantity > MAX_INT32) {
    errors.push('quantity must be a whole number of at least 1');
  }
  const unitPrice = Number(priceText);
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(priceText)) {
    errors.push('unitPrice must be a non-negative amount with at most 2 decimals');
  }

  return {
    rowNumber: row.rowNumber,
    poReference,
    vendorCode,
    currency,
    sku,
    quantity,
    unitPrice,
    errors,
  };
}

/** Format errors plus reference-data errors (unknown / non-orderable vendor, SKU). */
function rowProblems(row: ParsedRow, { vendors, products }: ResolvedReferences): string[] {
  const problems = [...row.errors];
  if (row.vendorCode && !vendors.has(row.vendorCode)) {
    problems.push(`vendor '${row.vendorCode}' not found or not orderable`);
  }
  if (row.sku && !products.has(row.sku)) {
    problems.push(`product '${row.sku}' not found or not purchasable`);
  }
  return problems;
}

function asResolved(refs: PreloadedReferences): ResolvedReferences {
  return refs as unknown as ResolvedReferences;
}

/**
 * Thin import handler — validates mapped rows and delegates each PO (all of its lines
 * present in the chunk) to ImportPurchaseOrderUseCase, one transaction per PO.
 * Vendors/products are resolved by code/SKU through the module's outbound ports.
 */
@Injectable()
export class PurchaseOrderImportHandler implements ImportHandler<PurchaseOrderImportRow> {
  constructor(
    private readonly vendors: OrderableVendorPort,
    private readonly products: PurchasableProductPort,
    private readonly importPurchaseOrder: ImportPurchaseOrderUseCase,
  ) {}

  async preloadReferences(rows: PurchaseOrderImportRow[]): Promise<PreloadedReferences> {
    const parsed = rows.map(parseRow);
    const vendorCodes = [...new Set(parsed.map(r => r.vendorCode).filter(Boolean))];
    const skus = [...new Set(parsed.map(r => r.sku).filter(Boolean))];

    const [vendors, products] = await Promise.all([
      vendorCodes.length
        ? this.vendors.findOrderableVendorsByCodes(vendorCodes)
        : Promise.resolve<VendorReference[]>([]),
      skus.length
        ? this.products.findPurchasableProductsBySkus(skus)
        : Promise.resolve<ProductReference[]>([]),
    ]);

    const resolved: ResolvedReferences = {
      vendors: new Map(vendors.map((v): [string, VendorReference] => [v.code.toUpperCase(), v])),
      products: new Map(products.map((p): [string, ProductReference] => [p.sku.toUpperCase(), p])),
    };
    return resolved as unknown as PreloadedReferences;
  }

  validateBatch(rows: PurchaseOrderImportRow[], refs: PreloadedReferences): Promise<RowVerdict[]> {
    const resolved = asResolved(refs);
    // Consistency is judged only among rows that are otherwise valid, so one bad
    // row cannot make its good siblings look inconsistent.
    const headers = new Map<string, { vendorCode: string; currency?: string }>();
    const lineKeys = new Set<string>();

    return Promise.resolve(
      rows.map(raw => {
        const row = parseRow(raw);
        const errors = rowProblems(row, resolved);

        if (errors.length === 0) {
          const header = headers.get(row.poReference);
          if (!header) {
            headers.set(row.poReference, { vendorCode: row.vendorCode, currency: row.currency });
          } else {
            if (header.vendorCode !== row.vendorCode) {
              errors.push(`vendorCode differs from earlier rows of '${row.poReference}'`);
            }
            if (row.currency && header.currency && header.currency !== row.currency) {
              errors.push(`currency differs from earlier rows of '${row.poReference}'`);
            }
            header.currency ??= row.currency;
          }
          const lineKey = `${row.poReference}\u0000${row.sku}`;
          if (lineKeys.has(lineKey)) {
            errors.push(`duplicate sku '${row.sku}' for poReference '${row.poReference}'`);
          } else {
            lineKeys.add(lineKey);
          }
        }

        return {
          rowNumber: row.rowNumber,
          status: errors.length ? 'INVALID' : 'VALID',
          errors: errors.length ? errors : undefined,
        } satisfies RowVerdict;
      }),
    );
  }

  async executeBatch(rows: PurchaseOrderImportRow[]): Promise<RowResult[]> {
    // The pipeline does not hand refs to executeBatch; resolving again (2 queries per
    // chunk) also picks up any vendor/product change since validation.
    const resolved = asResolved(await this.preloadReferences(rows));
    const results: RowResult[] = [];
    const groups = new Map<string, PoGroup>();

    for (const raw of rows) {
      const row = parseRow(raw);
      const problems = rowProblems(row, resolved);
      const vendor = resolved.vendors.get(row.vendorCode);
      const product = resolved.products.get(row.sku);
      if (problems.length || !vendor || !product) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'FAILED',
          errorMessage: problems.join('; ') || 'row is no longer valid',
        });
        continue;
      }

      const group = groups.get(row.poReference) ?? { vendor, rows: [], lines: [] };
      if (group.vendor.id !== vendor.id) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'FAILED',
          errorMessage: `vendorCode differs from earlier rows of '${row.poReference}'`,
        });
        continue;
      }
      group.currency ??= row.currency;
      group.rows.push(row);
      group.lines.push({ productId: product.id, quantity: row.quantity, unitPrice: row.unitPrice });
      groups.set(row.poReference, group);
    }

    for (const [externalReference, group] of groups) {
      try {
        const id = await this.importPurchaseOrder.execute({
          externalReference,
          vendorId: group.vendor.id,
          currency: group.currency,
          lines: group.lines,
        });
        for (const row of group.rows) {
          results.push({ rowNumber: row.rowNumber, status: 'APPLIED', entityId: id.toString() });
        }
      } catch (err) {
        const errorMessage = FailureMessage.of(err);
        for (const row of group.rows) {
          results.push({ rowNumber: row.rowNumber, status: 'FAILED', errorMessage });
        }
      }
    }
    return results;
  }
}
