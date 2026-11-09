import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderTransitionRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PurchaseOrderPublisherPort } from '../../integrations/publishes/publishers/purchase-order.publisher-port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';

// Single mutation path for submit/approve/reject/cancel/complete.
@Injectable()
export class PurchaseOrderTransitionUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly purchaseOrderQuery: PurchaseOrderQuery,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionRequest): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'PurchaseOrder',
      action: input.transition,
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const actorId = input.actorId ?? this.requestContext.getUserId();

    const id = input.id;
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    switch (input.transition) {
      case 'submit':
        purchaseOrder.submit();
        break;
      case 'approve': {
        policyRegistry.enforce('purchase-order.can-approve', {
          status: purchaseOrder.status,
          totalAmount: purchaseOrder.total.amount,
          autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        });
        purchaseOrder.approve(actorId);
        break;
      }
      case 'reject':
        purchaseOrder.reject(input.reason ?? 'Rejected', actorId);
        break;
      case 'cancel': {
        const hasPostedReceipts = await this.purchaseOrderQuery.hasReceipts(
          purchaseOrder.id.toString(),
        );
        purchaseOrder.cancel(actorId, hasPostedReceipts);
        break;
      }
      case 'complete':
        purchaseOrder.complete();
        break;
    }

    await this.purchaseOrderRepository.update(purchaseOrder);

    await this.audit.record({
      action: `purchase-order.${input.transition}`,
      entityType: 'PurchaseOrder',
      entityId: purchaseOrder.id.toString(),
      actorId,
      tenantId: this.requestContext.getTenantId(),
      companyId: this.requestContext.getCompanyId(),
      changes: { status: purchaseOrder.status, ...(input.reason ? { reason: input.reason } : {}) },
    });

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
