import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { PurchaseOrderTransitionRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class PurchaseOrderTransitionUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: PurchaseOrderTransitionRequest): Promise<PurchaseOrderId> {
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
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
