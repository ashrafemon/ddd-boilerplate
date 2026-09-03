import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@shared-kernel/ports';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { AddLineRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchasableProductQueryPort } from '../ports/outbound/product-query.port';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/ports/purchase-order-command-repository.port';
import { PurchaseOrderIntegrationPort } from '../integrations/publishers/purchase-order.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class AddPurchaseOrderLineUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    private readonly portResolver: ModulePortResolver,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
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

    purchaseOrder.addLine(
      input.productId,
      input.quantity,
      Money.fromDecimal(input.unitPrice, currency),
    );
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}