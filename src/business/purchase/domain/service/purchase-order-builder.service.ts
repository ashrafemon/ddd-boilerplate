import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared-business/value-object/money';
import { OrganizationId } from '../../../../shared-business/value-object/organization-id';
import { Quantity } from '../../../../shared-business/value-object/quantity';
import { TaxRate } from '../../../../shared-business/value-object/tax-rate';
import { TenantId } from '../../../../shared-business/value-object/tenant-id';
import { createUuid } from '../../../../shared-kernel/utilities/uuid';
import { Currency } from '../../../../shared-business/value-object/currency';
import { PurchaseOrder, PurchaseOrderSnapshot } from '../aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderId } from '../aggregate/purchase-order/purchase-order-id.vo';
import {
  PurchaseOrderLine,
  PurchaseOrderLineId,
} from '../aggregate/purchase-order/purchase-order-line.entity';
import { PurchaseOrderNumber } from '../value-object/purchase-order-number.vo';
import { ProductReference } from '../value-object/product-reference.vo';
import { VendorReference } from '../value-object/vendor-reference.vo';

export interface BuildLineInput {
  lineNumber: number;
  product: { productId: string; sku: string; productName: string; unit: string };
  description: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
  taxRateBps?: number;
}

export interface CreatePurchaseOrderData {
  id?: PurchaseOrderId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  number: string;
  vendor: VendorReference;
  currency: string;
  notes?: string;
  lines: BuildLineInput[];
}

/**
 * Domain builder for the PurchaseOrder aggregate. Constructs valid aggregates
 * and lines; use cases never assemble entities manually.
 */
@Injectable()
export class PurchaseOrderBuilder {
  public create(data: CreatePurchaseOrderData): PurchaseOrder {
    const order = PurchaseOrder.create({
      id: data.id ?? PurchaseOrderId.from(createUuid()),
      tenantId: data.tenantId,
      organizationId: data.organizationId,
      number: PurchaseOrderNumber.from(data.number),
      vendor: data.vendor,
      currency: data.currency,
      notes: data.notes,
    });

    for (const line of data.lines) {
      order.addLine(this.buildLine(line));
    }

    order.markCreated();
    return order;
  }

  public buildLine(input: BuildLineInput): PurchaseOrderLine {
    return PurchaseOrderLine.create({
      lineNumber: input.lineNumber,
      product: ProductReference.from(
        input.product.productId,
        input.product.sku,
        input.product.productName,
        input.product.unit,
      ),
      description: input.description,
      quantity: Quantity.from(input.quantity),
      unitPrice: Money.from(input.unitPriceCents, Currency.from(input.currency)),
      taxRate: input.taxRateBps !== undefined ? TaxRate.fromBasisPoints(input.taxRateBps) : undefined,
    });
  }

  public reconstitute(snapshot: PurchaseOrderSnapshot): PurchaseOrder {
    return PurchaseOrder.reconstitute(snapshot);
  }

  public reconstituteLine(input: {
    id: string;
    lineNumber: number;
    product: { productId: string; sku: string; productName: string; unit: string };
    description: string;
    quantity: number;
    unitPriceCents: number;
    currency: string;
    taxRateBps: number;
  }): PurchaseOrderLine {
    return PurchaseOrderLine.reconstitute(
      PurchaseOrderLineId.from(input.id),
      input.lineNumber,
      ProductReference.from(input.product.productId, input.product.sku, input.product.productName, input.product.unit),
      input.description,
      Quantity.from(input.quantity),
      Money.from(input.unitPriceCents, Currency.from(input.currency)),
      TaxRate.fromBasisPoints(input.taxRateBps),
    );
  }
}
