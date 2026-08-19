import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@shared-kernel/ports';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { AddLineRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects';
import { PurchasableProductQueryPort } from '../ports/outbound';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/domain-ports';

@Injectable()
export class AddPurchaseOrderLineUseCase  {
  constructor(
    @Inject(PurchaseOrderCommandRepositoryPort)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(ModulePortResolver) private readonly portResolver: ModulePortResolver,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  private get productQueryPort(): PurchasableProductQueryPort {
    return this.portResolver.resolvePort<PurchasableProductQueryPort>(PurchasableProductQueryPort);
  }

  @Transactional()
  async execute(input: AddLineRequest): Promise<PurchaseOrderId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw new ConflictException('Product is not purchasable');
    }

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    purchaseOrder.addLine(input.productId, input.quantity, Money.fromDecimal(input.unitPrice, currency));
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
