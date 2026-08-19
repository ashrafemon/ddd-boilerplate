import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { PurchaseOrderTransitionRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects';
import {
  PurchaseOrderCommandRepositoryPort,
} from '../../domain/domain-ports';

@Injectable()
export class PurchaseOrderTransitionUseCase  {
  constructor(
    @Inject(PurchaseOrderCommandRepositoryPort)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionRequest): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

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
