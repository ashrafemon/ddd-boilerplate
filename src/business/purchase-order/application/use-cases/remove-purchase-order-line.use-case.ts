import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { RemoveLineInput } from '../../ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_REPOSITORY,
  PurchaseOrderRepositoryPort,
} from '../../ports/outbound/purchase-order-repository.port';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';

@Injectable()
export class RemovePurchaseOrderLineUseCase implements UseCase<RemoveLineInput, PurchaseOrderId> {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: RemoveLineInput): Promise<PurchaseOrderId> {
    return this.unitOfWork.execute(async () => {
      const id = PurchaseOrderId.fromString(input.id);
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      if (!purchaseOrder) {
        throw PurchaseOrderErrors.notFound();
      }

      purchaseOrder.removeLine(input.productId);
      await this.purchaseOrderRepository.update(purchaseOrder);

      for (const event of purchaseOrder.pullEvents()) {
        await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
        this.eventBus.publish(event);
      }

      return purchaseOrder.id;
    });
  }
}
