import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { AuditPort } from '@platform/audit/ports/audit.port';
import { PurchaseOrderTransitionRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { HasPurchaseOrderReceiptsUseCase } from './has-purchase-order-receipts.usecase';

/**
 * Single mutation path for submit/approve/reject/cancel/complete.
 *
 * Phase 1 behaviors: actor comes from `RequestContextPort` with an explicit
 * `input.actorId` override (background batch/import workers restore context
 * via `run()`), and every successful transition writes an `AuditPort` row
 * inside this use case's own transaction — never after it. Failures write
 * nothing (the audit call sits after the state change and rolls back with it).
 */
@Injectable()
export class PurchaseOrderTransitionUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly hasReceipts: HasPurchaseOrderReceiptsUseCase,
    private readonly requestContext: RequestContextPort,
    private readonly audit: AuditPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionRequest): Promise<PurchaseOrderId> {
    const company = await this.companyConfig.getCompanyConfig();
    const actorId = input.actorId ?? this.requestContext.getUserId();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    switch (input.transition) {
      case 'submit':
        purchaseOrder.submit();
        break;
      case 'approve': {
        if (purchaseOrder.requiresManualApproval(company.autoApproveThreshold)) {
          throw new ConflictException('Manual approval required for this purchase order');
        }
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
        const hasPostedReceipts = await this.hasReceipts.execute(purchaseOrder.id.toString());
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

    return purchaseOrder.id;
  }
}
