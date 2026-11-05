import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RemoveLineRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPublisherPort } from '../integrations/publishes/purchase-order.publisher-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class RemovePurchaseOrderLineUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: RemoveLineRequest): Promise<string> {
    await this.companyConfig.getCompanyConfig();

    const id = input.id;
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    purchaseOrder.removeLine(input.productId);
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
