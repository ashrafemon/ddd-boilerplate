import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AuditPort } from '@platform/platform-common/audit/ports/audit.port';
import { policyRegistry } from '@business/shared-business/domain/registries/policy.registry';
import { PurchaseOrderTransitionRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { PurchaseOrderPublisherPort } from '../integrations/publishes/purchase-order.publisher-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

// Single mutation path for submit/approve/reject/cancel/complete.
@Injectable()
export class PurchaseOrderTransitionUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly purchaseOrderQuery: PurchaseOrderQuery,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionRequest): Promise<string> {
    const company = await this.companyConfig.getCompanyConfig();
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
          autoApproveThreshold: company.autoApproveThreshold,
        });
        purchaseOrder.approve(actorId);
        break;
      }
      case 'reject':
        // Plan Phase 2.3: the HTTP DTO makes `reason` required — no silent
        // default reaches the domain from the API layer.
        purchaseOrder.reject(input.reason ?? 'Rejected', actorId);
        break;
      case 'cancel': {
        // Plan Phase 2.4: CancellationPolicy — posted receipts block cancellation.
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
