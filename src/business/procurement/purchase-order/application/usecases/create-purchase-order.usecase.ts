import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { NumberingPort } from '../outbound-ports/numbering.port';

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly vendorQueryPort: OrderableVendorPort,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly numbering: NumberingPort,
  ) {}

  @Transactional()
  async execute(input: CreatePurchaseOrderRequest): Promise<PurchaseOrderId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
    if (!vendor) {
      throw new ConflictException('Vendor is not orderable (blocked or inactive)');
    }

    const orderNumber = await this.numbering.nextNumber('purchase-order.number', {
      prefix: 'PO-',
      padding: 8,
    });
    const purchaseOrder = PurchaseOrderFactory.create({
      orderNumber,
      vendorId: input.vendorId,
      currency,
      externalReference: input.externalReference,
    });

    await this.purchaseOrderRepository.save(purchaseOrder);
    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
