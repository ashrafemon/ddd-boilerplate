import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { ProductLookupPort } from '../../../domain/port/product-lookup.port';
import { PurchaseOrderPersistenceData, PurchaseOrderLinePersistenceData, PurchaseOrderWriteRepositoryPort } from '../../../domain/port/purchase-order-write-repository.port';
import { VendorLookupPort } from '../../../domain/port/vendor-lookup.port';
import { ProductPurchasabilityPolicy } from '../../../domain/policy/product-purchasability.policy';
import { VendorSelectionPolicy } from '../../../domain/policy/vendor-selection.policy';
import { PurchaseOrderBuilder } from '../../../domain/service/purchase-order-builder.service';
import { VendorReference } from '../../../domain/value-object/vendor-reference.vo';
import { createUuid } from '../../../../../shared-kernel/utilities/uuid';
import { Money } from '../../../../../shared-business/value-object/money';
import { Currency } from '../../../../../shared-business/value-object/currency';
import { UpdatePurchaseOrderInput, UpdatePurchaseOrderOutput } from '../../type/update-purchase-order.input';
import { UpdatePurchaseOrderPort } from '../../port/update-purchase-order.port';

/**
 * Updates a draft purchase order (vendor, lines, notes). Only DRAFT orders
 * can be changed — the aggregate enforces this.
 */
@Injectable()
export class UpdatePurchaseOrderUseCase implements UpdatePurchaseOrderPort {
  constructor(
    private readonly builder: PurchaseOrderBuilder,
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly vendorLookup: VendorLookupPort,
    private readonly productLookup: ProductLookupPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: UpdatePurchaseOrderInput): Promise<UpdatePurchaseOrderOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    if (input.vendorId) {
      const vendor = await this.vendorLookup.findForPurchase({ vendorId: input.vendorId });
      new VendorSelectionPolicy().enforce({
        vendorId: vendor.vendorId,
        vendorActive: vendor.isActive,
      });
      order.changeVendor(VendorReference.from(vendor.vendorId, vendor.code, vendor.name));
    }

    if (input.notes !== undefined) {
      order.changeNotes(input.notes);
    }

    const lineData: PurchaseOrderLinePersistenceData[] = [];

    if (input.lines) {
      const currency = order.getCurrency();
      for (const line of order.getLines()) {
        order.removeLine(line.getId().getValue());
      }
      for (let index = 0; index < input.lines.length; index++) {
        const lineInput = input.lines[index];
        const product = await this.productLookup.findForPurchase({
          productId: lineInput.productId,
        });
        new ProductPurchasabilityPolicy().enforce({
          productId: product.productId,
          sku: product.sku,
          productActive: product.isActive,
          isPurchasable: product.isPurchasable,
        });

        const description = lineInput.description ?? product.name;
        const unitPriceCents = lineInput.unitPriceCents ?? product.priceCents;
        const taxRateBps = lineInput.taxRateBps ?? 0;
        const unitPrice = Money.from(unitPriceCents, Currency.from(currency));
        const netAmount = unitPrice.multiplyBy(lineInput.quantity);
        const taxAmount = netAmount.multiplyBy(taxRateBps / 10000);
        const totalAmount = netAmount.add(taxAmount);

        order.addLine(
          this.builder.buildLine({
            lineNumber: index + 1,
            product: {
              productId: product.productId,
              sku: product.sku,
              productName: product.name,
              unit: product.unit,
            },
            description,
            quantity: lineInput.quantity,
            unitPriceCents,
            currency,
            taxRateBps,
          }),
        );

        lineData.push({
          id: createUuid(),
          lineNumber: index + 1,
          productId: lineInput.productId,
          description,
          quantity: lineInput.quantity,
          unitPriceCents,
          taxRateBps,
          netAmountCents: netAmount.getAmountCents(),
          taxAmountCents: taxAmount.getAmountCents(),
          totalCents: totalAmount.getAmountCents(),
        });
      }
    }

    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      vendorId: input.vendorId,
      notes: input.notes,
      lines: input.lines ? lineData : undefined,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      order.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: organizationId.getValue(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return { purchaseOrderId: input.purchaseOrderId, updatedAt: new Date() };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }

  private requireOrganizationId(): OrganizationId {
    const value = this.requestContext.getOrganizationId();
    if (!value) throw new UnauthorizedException('Organization context is required');
    return OrganizationId.from(value);
  }
}
