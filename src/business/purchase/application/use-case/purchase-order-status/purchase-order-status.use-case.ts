import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { AggregateNotFoundException } from '../../../../../shared-kernel/exceptions/aggregate-not-found.exception';
import { UnauthorizedException } from '../../../../../shared-kernel/exceptions/unauthorized.exception';
import { TenantId } from '../../../../../shared-business/value-object/tenant-id';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { PurchaseOrderId } from '../../../domain/aggregate/purchase-order/purchase-order-id.vo';
import { PurchaseOrder } from '../../../domain/aggregate/purchase-order/purchase-order.entity';
import { PurchaseOrderStatusTransitionInvariant } from '../../../domain/invariant/purchase-order-status-transition.invariant';
import { OutboxPort } from '../../../domain/port/outbox.port';
import { PurchaseOrderPersistenceData, PurchaseOrderWriteRepositoryPort } from '../../../domain/port/purchase-order-write-repository.port';
import { PurchaseOrderStatusValue } from '../../../domain/value-object/purchase-order-status.vo';
import { InvariantRegistry } from '../../../../../shared-business/invariant/invariant-registry';
import {
  CancelPurchaseOrderInput,
  PurchaseOrderIdOutput,
  RejectPurchaseOrderInput,
} from '../../type/purchase-order-command.input';
import {
  CancelPurchaseOrderPort,
  CompletePurchaseOrderPort,
  RejectPurchaseOrderPort,
} from '../../port/purchase-order-status.port';

/**
 * Rejects a purchase order inside a transaction.
 */
@Injectable()
export class RejectPurchaseOrderUseCase implements RejectPurchaseOrderPort {
  constructor(
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: RejectPurchaseOrderInput): Promise<PurchaseOrderIdOutput> {
    const tenantId = this.requireTenantId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    this.assertTransition(order, PurchaseOrderStatusValue.REJECTED);
    order.reject(input.reason);
    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.REJECTED,
      rejectedAt: new Date(),
      rejectedReason: input.reason,
    };
    await this.writeRepository.save(data);
    await this.appendOutboxEvents(order);

    return { purchaseOrderId: input.purchaseOrderId, status: PurchaseOrderStatusValue.REJECTED };
  }

  private assertTransition(order: PurchaseOrder, target: PurchaseOrderStatusValue): void {
    InvariantRegistry.create()
      .add(new PurchaseOrderStatusTransitionInvariant())
      .enforceAll({ current: order.getStatus(), target });
  }

  private async appendOutboxEvents(order: PurchaseOrder): Promise<void> {
    await this.outbox.appendMany(
      order.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: order.getTenantId().getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}

/**
 * Cancels a purchase order inside a transaction.
 */
@Injectable()
export class CancelPurchaseOrderUseCase implements CancelPurchaseOrderPort {
  constructor(
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: CancelPurchaseOrderInput): Promise<PurchaseOrderIdOutput> {
    const tenantId = this.requireTenantId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    this.assertTransition(order, PurchaseOrderStatusValue.CANCELLED);
    order.cancel(input.reason);
    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.CANCELLED,
      cancelledAt: new Date(),
      cancelledReason: input.reason,
    };
    await this.writeRepository.save(data);
    await this.appendOutboxEvents(order);

    return { purchaseOrderId: input.purchaseOrderId, status: PurchaseOrderStatusValue.CANCELLED };
  }

  private assertTransition(order: PurchaseOrder, target: PurchaseOrderStatusValue): void {
    InvariantRegistry.create()
      .add(new PurchaseOrderStatusTransitionInvariant())
      .enforceAll({ current: order.getStatus(), target });
  }

  private async appendOutboxEvents(order: PurchaseOrder): Promise<void> {
    await this.outbox.appendMany(
      order.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: order.getTenantId().getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}

/**
 * Completes a purchase order inside a transaction.
 */
@Injectable()
export class CompletePurchaseOrderUseCase implements CompletePurchaseOrderPort {
  constructor(
    private readonly writeRepository: PurchaseOrderWriteRepositoryPort,
    private readonly outbox: OutboxPort,
    private readonly requestContext: RequestContextPort,
  ) {}

  @Transactional()
  public async execute(input: { purchaseOrderId: string }): Promise<PurchaseOrderIdOutput> {
    const tenantId = this.requireTenantId();

    const order = await this.writeRepository.findById(PurchaseOrderId.from(input.purchaseOrderId));
    if (!order || !order.getTenantId().equals(tenantId)) {
      throw new AggregateNotFoundException('PurchaseOrder', input.purchaseOrderId);
    }

    this.assertTransition(order, PurchaseOrderStatusValue.COMPLETED);
    order.complete();
    const data: PurchaseOrderPersistenceData = {
      operation: 'update',
      id: input.purchaseOrderId,
      status: PurchaseOrderStatusValue.COMPLETED,
      completedAt: new Date(),
    };
    await this.writeRepository.save(data);
    await this.appendOutboxEvents(order);

    return { purchaseOrderId: input.purchaseOrderId, status: PurchaseOrderStatusValue.COMPLETED };
  }

  private assertTransition(order: PurchaseOrder, target: PurchaseOrderStatusValue): void {
    InvariantRegistry.create()
      .add(new PurchaseOrderStatusTransitionInvariant())
      .enforceAll({ current: order.getStatus(), target });
  }

  private async appendOutboxEvents(order: PurchaseOrder): Promise<void> {
    await this.outbox.appendMany(
      order.pullDomainEvents().map((event) =>
        event.toOutboxEventInput({
          tenantId: order.getTenantId().getValue(),
          organizationId: this.requestContext.getOrganizationId(),
          correlationId: this.requestContext.getCorrelationId(),
        }),
      ),
    );
  }

  private requireTenantId(): TenantId {
    const value = this.requestContext.getTenantId();
    if (!value) throw new UnauthorizedException('Tenant context is required');
    return TenantId.from(value);
  }
}
