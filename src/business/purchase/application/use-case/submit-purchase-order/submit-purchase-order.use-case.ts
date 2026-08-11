import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrderMustHaveLinesInvariant } from '../../../domain/invariant/purchase-order-must-have-lines.invariant';
import { PurchaseOrderStatusTransitionInvariant } from '../../../domain/invariant/purchase-order-status-transition.invariant';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { PurchaseOrderPersistenceData, PurchaseOrderWriteRepositoryPort } from '../../../domain/port/purchase-order-write-repository.port';
import { PurchaseOrderStatus, PurchaseOrderStatusValue } from '../../../domain/value-object/purchase-order-status.vo';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { PurchaseOrderIdInput, PurchaseOrderIdOutput } from '../../type/purchase-order-command.input';
import { SubmitPurchaseOrderPort } from '../../port/submit-purchase-order.port';

interface SubmitPurchaseOrderContext {
  lineCount: number;
  current: PurchaseOrderStatus;
  target: PurchaseOrderStatusValue;
}

/**
 * Submits a purchase order for approval. Invariants (at least one line,
 * legal status transition) are orchestrated here via the invariant registry.
 */
@Injectable()
export class SubmitPurchaseOrderUseCase implements SubmitPurchaseOrderPort {
  constructor(
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: PurchaseOrderIdInput): Promise<PurchaseOrderIdOutput> {
    const tenantId = this.requireTenantId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    InvariantRegistry.create<SubmitPurchaseOrderContext>()
      .add(new PurchaseOrderMustHaveLinesInvariant())
      .add(new PurchaseOrderStatusTransitionInvariant())
      .enforceAll({
        lineCount: order.getLines().length,
        current: order.getStatus(),
        target: PurchaseOrderStatusValue.SUBMITTED,
      });

    order.submit();
    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.SUBMITTED,
      submittedAt: new Date(),
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

    return { purchaseOrderId: input.purchaseOrderId, status: PurchaseOrderStatusValue.SUBMITTED };
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}
