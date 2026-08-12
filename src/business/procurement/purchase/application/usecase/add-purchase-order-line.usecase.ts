import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';
import {
  PURCHASE_ORDER_PRODUCT_PORT,
  PurchasableProductQueryPort,
} from '../../ports/outbound/product-query.port';
import {
  PURCHASE_ORDER_COMMAND_REPOSITORY,
  PurchaseOrderCommandRepositoryPort,
} from '../../ports/outbound/purchase-order-command-repository.port';

export interface AddLineInput {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
}

@Injectable()
export class AddPurchaseOrderLineUseCase implements CommandUseCase<AddLineInput, PurchaseOrderId> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepositoryPort,
    @Inject(PURCHASE_ORDER_PRODUCT_PORT)
    private readonly productQueryPort: PurchasableProductQueryPort,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: AddLineInput): Promise<PurchaseOrderId> {
    await this.companyConfig.getCompanyConfig();

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw PurchaseOrderErrors.notFound();
    }

    // Cross-aggregate call: product facade through the outbound port.
    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw PurchaseOrderErrors.productNotPurchasable();
    }

    purchaseOrder.addLine(
      input.productId,
      input.quantity,
      Money.fromDecimal(input.unitPrice, input.currency ?? purchaseOrder.currency),
    );
    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
      this.eventBus.publish(event);
    }

    return purchaseOrder.id;
  }
}
