import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { PurchaseOrderId } from '../../domain/value-objects';
import {
  PurchaseOrderCommandRepositoryPort,
  PurchaseOrderCommandRepositoryPort,
} from '../../domain/domain-ports';

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
    @Inject(PurchaseOrderCommandRepositoryPort)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionInput): Promise<PurchaseOrderId> {
    // Orchestration step 1: company configuration — the approval threshold
    // drives the approval policy.
    const company = await this.companyConfig.getCompanyConfig();

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
    }

    return purchaseOrder.id;
  }
}
