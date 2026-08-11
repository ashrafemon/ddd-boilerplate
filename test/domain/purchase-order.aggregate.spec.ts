import { Currency } from '../../src/shared-business/value-object/currency';
import { Money } from '../../src/shared-business/value-object/money';
import { OrganizationId } from '../../src/shared-business/value-object/organization-id';
import { Quantity } from '../../src/shared-business/value-object/quantity';
import { TenantId } from '../../src/shared-business/value-object/tenant-id';
import { PurchaseOrder } from '../../src/business/purchase/domain/aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderId } from '../../src/business/purchase/domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderLine } from '../../src/business/purchase/domain/aggregate/purchase-order/purchase-order-line.entity';
import { PurchaseOrderNumber } from '../../src/business/purchase/domain/value-object/purchase-order-number.vo';
import { ProductReference } from '../../src/business/purchase/domain/value-object/product-reference.vo';
import { VendorReference } from '../../src/business/purchase/domain/value-object/vendor-reference.vo';
import { InvariantViolationException } from '../../src/shared-kernel/exceptions/invariant-violation.exception';
import { ConflictException } from '../../src/shared-kernel/exceptions/conflict.exception';
import { InvariantRegistry } from '../../src/shared-business/invariant/invariant-registry';
import { PurchaseOrderMustHaveLinesInvariant } from '../../src/business/purchase/domain/invariant/purchase-order-must-have-lines.invariant';

function buildOrder(status: 'draft' | 'submitted' | 'approved' = 'draft'): PurchaseOrder {
  const order = PurchaseOrder.create({
    id: PurchaseOrderId.from('po-1'),
    tenantId: TenantId.from('tenant-1'),
    organizationId: OrganizationId.from('org-1'),
    number: PurchaseOrderNumber.from('PO-2026-0001'),
    vendor: VendorReference.from('vendor-1', 'V-0001', 'Acme'),
    currency: 'USD',
  });

  const product = ProductReference.from('product-1', 'SKU-1', 'Widget', 'EA');
  order.addLine(
    PurchaseOrderLine.create({
      lineNumber: 1,
      product,
      description: 'Widget',
      quantity: Quantity.from(10),
      unitPrice: Money.from(500, Currency.from('USD')),
      taxRate: undefined,
    }),
  );

  if (status === 'submitted') order.submit();
  if (status === 'approved') {
    order.submit();
    order.approve('user-1');
  }

  order.pullDomainEvents();
  return order;
}

describe('PurchaseOrder aggregate', () => {
  it('computes line and order totals', () => {
    const order = buildOrder();
    expect(order.getTotal().getAmountCents()).toBe(5000);
    expect(order.getLines()[0].getNetAmount().getAmountCents()).toBe(5000);
  });

  it('computes tax on lines', () => {
    const order = buildOrder();
    order.removeLine(order.getLines()[0].getId().getValue());
    order.addLine(
      PurchaseOrderLine.create({
        lineNumber: 1,
        product: ProductReference.from('product-1', 'SKU-1', 'Widget', 'EA'),
        description: 'Widget',
        quantity: Quantity.from(100),
        unitPrice: Money.from(100, Currency.from('USD')),
        taxRate: undefined,
      }),
    );
    const line = order.getLines()[0];
    // 100 * $1.00 = $100 net
    expect(line.getNetAmount().getAmountCents()).toBe(10000);
    expect(line.getTaxAmount().getAmountCents()).toBe(0);
    expect(line.getTotalAmount().getAmountCents()).toBe(10000);
  });

  it('rejects submitting an order without lines via the invariant registry', () => {
    const order = PurchaseOrder.create({
      id: PurchaseOrderId.from('po-empty'),
      tenantId: TenantId.from('tenant-1'),
      organizationId: OrganizationId.from('org-1'),
      number: PurchaseOrderNumber.from('PO-2026-0002'),
      vendor: VendorReference.from('vendor-1', 'V-0001', 'Acme'),
      currency: 'USD',
    });
    expect(() =>
      InvariantRegistry.create()
        .add(new PurchaseOrderMustHaveLinesInvariant())
        .enforceAll({ lineCount: order.getLines().length }),
    ).toThrow(InvariantViolationException);
    expect(order.getLines()).toHaveLength(0);
  });

  it('only allows line changes while DRAFT', () => {
    const order = buildOrder('submitted');
    expect(() =>
      order.addLine(
        PurchaseOrderLine.create({
          lineNumber: 2,
          product: ProductReference.from('product-2', 'SKU-2', 'Widget', 'EA'),
          description: 'Late',
          quantity: Quantity.from(1),
          unitPrice: Money.from(1, Currency.from('USD')),
        }),
      ),
    ).toThrow(ConflictException);
  });

  it('approves only from SUBMITTED', () => {
    const draft = buildOrder();
    expect(() => draft.approve('user-1')).toThrow(ConflictException);

    const submitted = buildOrder('submitted');
    submitted.approve('user-1');
    expect(submitted.getStatusValue()).toBe('APPROVED');
    expect(submitted.getApprovedAt()).toBeInstanceOf(Date);
  });

  it('cannot be approved twice', () => {
    const approved = buildOrder('approved');
    expect(() => approved.approve('user-1')).toThrow(ConflictException);
  });

  it('records and clears domain events', () => {
    const order = buildOrder();
    order.submit();
    const events = order.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('purchase.order.submitted');
    expect(order.pullDomainEvents()).toHaveLength(0);
  });

  it('follows the full lifecycle', () => {
    const order = buildOrder();
    order.submit();
    order.approve('user-1');
    order.complete();
    expect(order.getStatusValue()).toBe('COMPLETED');
  });

  it('rejects invalid status transitions', () => {
    const order = buildOrder();
    expect(() => order.complete()).toThrow(ConflictException);
    expect(() => order.approve('user-1')).toThrow(ConflictException);
  });
});
