import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { PolicyViolationException } from '../../../../../shared-kernel/exceptions/policy-violation.exception';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderCannotBeApprovedTwiceInvariant } from '../../../domain/invariant/purchase-order-cannot-be-approved-twice.invariant';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { PurchaseOrderPersistenceData, PurchaseOrderWriteRepositoryPort } from '../../../domain/port/purchase-order-write-repository.port';
import { PurchaseOrganizationConfigurationPort } from '../../../domain/port/purchase-organization-configuration.port';
import { VendorLookupPort } from '../../../domain/port/vendor-lookup.port';
import { PurchaseApprovalPolicy } from '../../../domain/policy/purchase-approval.policy';
import { PurchaseOrderStatusValue } from '../../../domain/value-object/purchase-order-status.vo';
import { ApprovePurchaseOrderInput, ApprovePurchaseOrderOutput } from '../../port/approve-purchase-order.port';

/**
 * Approves a purchase order. The approval policy verifies that the vendor is
 * active and that the total stays within the organization's approval limit.
 * Orders above the additional-approval threshold are rejected by the policy.
 */
@Injectable()
export class ApprovePurchaseOrderUseCase {
  constructor(
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly vendorLookup: VendorLookupPort,
    private readonly organizationConfiguration: PurchaseOrganizationConfigurationPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: ApprovePurchaseOrderInput): Promise<ApprovePurchaseOrderOutput> {
    const tenantId = this.requireTenantId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    InvariantRegistry.create()
      .add(new PurchaseOrderCannotBeApprovedTwiceInvariant())
      .enforceAll({ current: order.getStatus() });

    const vendor = await this.vendorLookup.findForPurchase({
      vendorId: order.getVendor().getVendorId(),
    });

    const configuration = await this.organizationConfiguration.getForOrganization(
      order.getOrganizationId().getValue(),
    );

    const decision = new PurchaseApprovalPolicy().evaluate({
      purchaseOrderId: order.getId().getValue(),
      totalCents: order.getTotal().getAmountCents(),
      currency: order.getCurrency(),
      vendorActive: vendor.isActive,
      approvalLimitCents: configuration.approvalLimitCents,
      requiresAdditionalApprovalLimitCents: configuration.requiresAdditionalApprovalLimitCents,
    });

    if (decision.requiresAdditionalApproval) {
      throw new PolicyViolationException(
        `Purchase order ${order.getNumber().getValue()} exceeds the approval limit and requires additional approval`,
        { purchaseOrderId: order.getId().getValue(), ...decision.reasons },
      );
    }

    if (!decision.isAllowed) {
      throw new PolicyViolationException('Purchase order approval was denied', {
        purchaseOrderId: order.getId().getValue(),
        reasons: decision.reasons,
      });
    }

    order.approve(input.approvedByUserId ?? this.requestContext.getUserId());
    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: input.approvedByUserId ?? this.requestContext.getUserId() ?? null,
    };
    await this.writeRepository.save(data);

    await this.outbox.appendMany(
      order.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: tenantId.getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );

    return {
      purchaseOrderId: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.APPROVED,
      requiresAdditionalApproval: false,
    };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}
