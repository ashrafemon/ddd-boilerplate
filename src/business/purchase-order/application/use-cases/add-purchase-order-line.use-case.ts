import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { AddLineInput } from '../../ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_REPOSITORY,
  PurchaseOrderRepositoryPort,
} from '../../ports/outbound/purchase-order-repository.port';
import {
  PURCHASE_ORDER_PRODUCT_PORT,
  PurchasableProductQueryPort,
} from '../../ports/outbound/product-query.port';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { Money } from '@business/shared-business/domain/money.value-object';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';

@Injectable()
export class AddPurchaseOrderLineUseCase implements UseCase<AddLineInput, PurchaseOrderId> {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderRepositoryPort,
    @Inject(PURCHASE_ORDER_PRODUCT_PORT)
    private readonly productQueryPort: PurchasableProductQueryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: AddLineInput): Promise<PurchaseOrderId> {
    return this.unitOfWork.execute(async () => {
      const id = PurchaseOrderId.fromString(input.id);
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      if (!purchaseOrder) {
        throw PurchaseOrderErrors.notFound();
      }

      // Cross-module communication: PO -> Product inbound port.
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
    });
  }
}
