import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { ModulePortResolver } from '@shared-kernel/ports';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { purchaseOrderFactory } from '../../domain/factories';
import { PurchaseOrderId } from '../../domain/value-objects';
import { OrderableVendorQueryPort } from '../ports/outbound';
import { PurchaseOrderCommandRepositoryPort } from '../../domain/domain-ports';

@Injectable()
export class CreatePurchaseOrderUseCase implements CommandUseCase<CreatePurchaseOrderRequest, PurchaseOrderId> {
  constructor(
    @Inject(PurchaseOrderCommandRepositoryPort)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(ModulePortResolver) private readonly portResolver: ModulePortResolver,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
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
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
