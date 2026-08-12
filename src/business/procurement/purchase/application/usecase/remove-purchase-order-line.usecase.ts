import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
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

export interface RemoveLineInput {
  id: string;
  productId: string;
}

@Injectable()
export class RemovePurchaseOrderLineUseCase implements CommandUseCase<
  RemoveLineInput,
  PurchaseOrderId
> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: RemoveLineInput): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw PurchaseOrderErrors.notFound();
    }

    purchaseOrder.removeLine(input.productId);
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
