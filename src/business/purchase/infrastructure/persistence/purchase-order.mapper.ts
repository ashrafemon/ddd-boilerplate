import { Prisma } from '@prisma/client';
import { Currency } from '../../../../shared-business/value-object/currency';
import { Money } from '../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Quantity } from '../../../../shared-business/value-object/quantity';
import { TaxRate } from '../../../../shared-business/value-object/tax-rate';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { PurchaseOrderSnapshot } from '../../domain/aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderId } from '../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderLine, PurchaseOrderLineId } from '../../domain/aggregate/purchase-order/purchase-order-line.entity';
import { PurchaseOrderNumber } from '../../domain/value-object/purchase-order-number.vo';
import { ProductReference } from '../../domain/value-object/product-reference.vo';
import { PurchaseOrderStatus } from '../../domain/value-object/purchase-order-status.vo';
import { VendorReference } from '../../domain/value-object/vendor-reference.vo';
import { PurchaseOrderReadModel } from '../../domain/port/purchase-order-read-repository.port';

type PurchaseOrderRow = Prisma.PurchaseOrderGetPayload<{ include: { lines: true } }>;
type PurchaseOrderLineRow = PurchaseOrderRow['lines'][number];

/**
 * Maps between the PurchaseOrder domain aggregate and its persistence model.
 */
export class PurchaseOrderMapper {
  public static toSnapshot(
    row: PurchaseOrderRow,
    vendor: { id: string; code: string; name: string } | null,
    currency: string,
  ): PurchaseOrderSnapshot {
    return {
      id: PurchaseOrderId.from(row.id),
      tenantId: TenantId.from(row.tenantId),
      organizationId: OrganizationId.from(row.organizationId),
      number: PurchaseOrderNumber.from(row.number),
      vendor: VendorReference.from(
        row.vendorId,
        vendor?.code ?? row.vendorId,
        vendor?.name ?? row.vendorId,
      ),
      status: PurchaseOrderStatus.from(row.status),
      currency: row.currency,
      lines: row.lines.map((line) => toLine(line, currency)),
      notes: row.notes ?? undefined,
      submittedAt: row.submittedAt ?? undefined,
      approvedAt: row.approvedAt ?? undefined,
      approvedByUserId: row.approvedByUserId ?? undefined,
      rejectedAt: row.rejectedAt ?? undefined,
      rejectedReason: row.rejectedReason ?? undefined,
      cancelledAt: row.cancelledAt ?? undefined,
      cancelledReason: row.cancelledReason ?? undefined,
      completedAt: row.completedAt ?? undefined,
    };
  }





  public static toReadModel(
    row: PurchaseOrderRow,
    vendor: { id: string; code: string; name: string } | null,
  ): PurchaseOrderReadModel {
    return {
      id: row.id,
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      number: row.number,
      vendorId: row.vendorId,
      vendorCode: vendor?.code ?? row.vendorId,
      vendorName: vendor?.name ?? row.vendorId,
      status: row.status,
      currency: row.currency,
      totalCents: row.totalCents,
      notes: row.notes,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedByUserId: row.approvedByUserId,
      rejectedAt: row.rejectedAt,
      rejectedReason: row.rejectedReason,
      cancelledAt: row.cancelledAt,
      cancelledReason: row.cancelledReason,
      completedAt: row.completedAt,
      lines: row.lines.map(toLineReadModel),
    };
  }


}

function toLine(row: PurchaseOrderLineRow, currency: string): PurchaseOrderLine {
  return PurchaseOrderLine.reconstitute(
    PurchaseOrderLineId.from(row.id),
    row.lineNumber,
    ProductReference.from(row.productId, row.productId, row.description, 'EA'),
    row.description,
    Quantity.from(Number(row.quantity)),
    Money.from(row.unitPriceCents, Currency.from(currency)),
    TaxRate.fromBasisPoints(row.taxRateBps),
  );
}

function toLineReadModel(line: PurchaseOrderLineRow): PurchaseOrderReadModel['lines'][number] {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    productId: line.productId,
    description: line.description,
    quantity: line.quantity.toString(),
    unitPriceCents: line.unitPriceCents,
    taxRateBps: line.taxRateBps,
    netAmountCents: line.netAmountCents,
    taxAmountCents: line.taxAmountCents,
    totalCents: line.totalCents,
  };
}
