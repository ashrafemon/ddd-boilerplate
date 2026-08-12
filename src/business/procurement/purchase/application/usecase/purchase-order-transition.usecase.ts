import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';
import {
  PURCHASE_ORDER_COMMAND_REPOSITORY,
  PurchaseOrderCommandRepositoryPort,
} from '../../domain/ports/purchase-order-command-repository.port';

export type PurchaseOrderTransition = 'submit' | 'approve' | 'reject' | 'cancel' | 'complete';

export interface PurchaseOrderTransitionInput {
  id: string;
  transition: PurchaseOrderTransition;
  reason?: string;
}

@Injectable()
export class PurchaseOrderTransitionUseCase implements CommandUseCase<
  PurchaseOrderTransitionInput,
  PurchaseOrderId
> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionInput): Promise<PurchaseOrderId> {
    // Orchestration step 1: company configuration — the approval threshold
    // drives the approval policy.
    const company = await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw PurchaseOrderErrors.notFound();
    }

    switch (input.transition) {
      case 'submit':
        purchaseOrder.submit();
        break;
      case 'approve': {
        // Policy decision: orders above the company's threshold need manual
        // approval (the saga routes them), so this command only auto-approves.
        if (!purchaseOrder.requiresManualApproval(company.autoApproveThreshold)) {
          purchaseOrder.approve();
        }
        break;
      }
      case 'reject':
        purchaseOrder.reject(input.reason ?? 'Rejected');
        break;
      case 'cancel':
        purchaseOrder.cancel();
        break;
      case 'complete':
        purchaseOrder.complete();
        break;
    }

    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
      this.eventBus.publish(event);
    }

    return purchaseOrder.id;
  }
}
