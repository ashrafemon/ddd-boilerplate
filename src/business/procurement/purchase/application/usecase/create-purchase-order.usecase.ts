import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ModulePortResolver } from '@shared-kernel/ports';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { purchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { OrderableVendorQueryPort } from '../ports/outbound/vendor-query.port';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/ports/purchase-order-command-repository.port';
import { PurchaseOrderIntegrationPort } from '../integrations/publishers/purchase-order.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    private readonly portResolver: ModulePortResolver,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  private get vendorQueryPort(): OrderableVendorQueryPort {
    return this.portResolver.resolvePort<OrderableVendorQueryPort>(OrderableVendorQueryPort);
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
    const purchaseOrder = purchaseOrderFactory.create({
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