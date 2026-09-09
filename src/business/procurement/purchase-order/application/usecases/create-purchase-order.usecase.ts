import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@platform/context/ports/module-port-resolver.port';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly portResolver: ModulePortResolver,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  private get vendorQueryPort(): OrderableVendorPort {
    return this.portResolver.resolvePort<OrderableVendorPort>(OrderableVendorPort);
  }

  @Transactional()
  async execute(input: CreatePurchaseOrderRequest): Promise<PurchaseOrderId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
    if (!vendor) {
      throw new ConflictException('Vendor is not orderable (blocked or inactive)');
    }

    const sequence = await this.purchaseOrderRepository.nextOrderSequence();
    const purchaseOrder = PurchaseOrderFactory.create({
      orderNumber: `PO-${String(sequence).padStart(8, '0')}`,
      vendorId: input.vendorId,
      currency,
    });

    await this.purchaseOrderRepository.save(purchaseOrder);
    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
