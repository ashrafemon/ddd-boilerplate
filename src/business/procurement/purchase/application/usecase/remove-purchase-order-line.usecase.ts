import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RemoveLineRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/ports/purchase-order-command-repository.port';
import { PurchaseOrderIntegrationPort } from '../integrations/publishers/purchase-order.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class RemovePurchaseOrderLineUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: RemoveLineRequest): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    purchaseOrder.removeLine(input.productId);
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}