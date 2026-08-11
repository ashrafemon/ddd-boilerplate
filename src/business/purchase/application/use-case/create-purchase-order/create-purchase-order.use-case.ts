import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OrganizationId } from '../../../../../shared-business/value-object/organization-id';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { DocumentNumberGeneratorPort } from '../../../domain/port/document-number-generator.port';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { ProductLookupPort } from '../../../domain/port/product-lookup.port';
import { PurchaseOrderLinePersistenceData, PurchaseOrderPersistenceData, PurchaseOrderWriteRepositoryPort } from '../../../domain/port/purchase-order-write-repository.port';
import { PurchaseOrganizationConfigurationPort } from '../../../domain/port/purchase-organization-configuration.port';
import { VendorLookupPort } from '../../../domain/port/vendor-lookup.port';
import { ProductPurchasabilityPolicy } from '../../../domain/policy/product-purchasability.policy';
import { VendorSelectionPolicy } from '../../../domain/policy/vendor-selection.policy';
import { PurchaseOrderBuilder, BuildLineInput } from '../../../domain/service/purchase-order-builder.service';
import { VendorReference } from '../../../domain/value-object/vendor-reference.vo';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import { PolicyRegistry } from '../../../../../shared-business/policy/policy-registry';
import { PurchaseOrderTotalMustMatchLinesInvariant } from '../../../domain/invariant/purchase-order-total-must-match-lines.invariant';
import { createUuid } from '../../../../../shared-kernel/utilities/uuid';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderStatusValue } from '../../../domain/value-object/purchase-order-status.vo';
import { Money } from '../../../../../shared-business/value-object/money';
import { Currency } from '../../../../../shared-business/value-object/currency';
import { CreatePurchaseOrderInput, CreatePurchaseOrderOutput } from '../../type/create-purchase-order.input';
import { CreatePurchaseOrderPort } from '../../port/create-purchase-order.port';

/**
 * Creates a purchase order. Orchestrates vendor/product lookups through the
 * purchase-owned ports, enforces selection policies and the total-vs-lines
 * invariant, builds the aggregate with the domain builder and persists
 * everything (aggregate + outbox events) in a single transaction.
 */
@Injectable()
export class CreatePurchaseOrderUseCase implements CreatePurchaseOrderPort {
  constructor(
    private readonly builder: PurchaseOrderBuilder,
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly vendorLookup: VendorLookupPort,
    private readonly productLookup: ProductLookupPort,
    private readonly organizationConfiguration: PurchaseOrganizationConfigurationPort,
    private readonly numberGenerator: DocumentNumberGeneratorPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: CreatePurchaseOrderInput): Promise<CreatePurchaseOrderOutput> {
    const tenantId = this.requireTenantId();
    const organizationId = this.requireOrganizationId();

    const vendor = await this.vendorLookup.findForPurchase({ vendorId: input.vendorId });
    PolicyRegistry.create()
      .add(new VendorSelectionPolicy())
      .enforceAll({
        vendorId: vendor.vendorId,
        vendorActive: vendor.isActive,
      });

    const configuration = await this.organizationConfiguration.getForOrganization(
      organizationId.getValue(),
    );
    const number = await this.numberGenerator.generate(configuration.numberingPrefix);

    const currency = input.currency ?? 'USD';
    const purchaseOrderId = createUuid();
    const lines: BuildLineInput[] = [];
    const lineData: PurchaseOrderLinePersistenceData[] = [];

    for (let index = 0; index < input.lines.length; index++) {
      const lineInput = input.lines[index];
      const product = await this.productLookup.findForPurchase({ productId: lineInput.productId });

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

      lines.push({
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
      });

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

    const order = this.builder.create({
      id: PurchaseOrderId.from(purchaseOrderId),
      tenantId,
      organizationId,
      number,
      vendor: VendorReference.from(vendor.vendorId, vendor.code, vendor.name),
      currency,
      notes: input.notes,
      lines,
    });

    InvariantRegistry.create()
      .add(new PurchaseOrderTotalMustMatchLinesInvariant())
      .enforceAll({
        totalCents: order.getTotal().getAmountCents(),
        lineTotalsCents: order.getLines().map((line) => line.getTotalAmount().getAmountCents()),
      });

    const data: PurchaseOrderPersistenceData = {
      operation: 'create',
      id: purchaseOrderId,
      tenantId: tenantId.getValue(),
      organizationId: organizationId.getValue(),
      number,
      vendorId: input.vendorId,
      status: PurchaseOrderStatusValue.DRAFT,
      currency,
      totalCents: lineData.reduce((sum, line) => sum + line.totalCents, 0),
      notes: input.notes ?? null,
      lines: lineData,
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

    return { purchaseOrderId, number };
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
