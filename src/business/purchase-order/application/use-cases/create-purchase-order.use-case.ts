import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CreatePurchaseOrderInput } from '../../ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_REPOSITORY,
  PurchaseOrderRepositoryPort,
} from '../../ports/outbound/purchase-order-repository.port';
import {
  OrderableVendorQueryPort,
  PURCHASE_ORDER_VENDOR_PORT,
} from '../../ports/outbound/vendor-query.port';
import { PurchaseOrder } from '../../domain/entities/purchase-order.aggregate';
import { OrderNumber } from '../../domain/value-objects/purchase-order.vos';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';

@Injectable()
export class CreatePurchaseOrderUseCase implements UseCase<
  CreatePurchaseOrderInput,
  PurchaseOrderId
> {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderRepositoryPort,
    @Inject(PURCHASE_ORDER_VENDOR_PORT)
    private readonly vendorQueryPort: OrderableVendorQueryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrderId> {
    return this.unitOfWork.execute(async () => {
      // Cross-module communication: PO -> Vendor inbound port (application
      // service), never VendorRepository or the vendor Prisma model.
      const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
      if (!vendor) {
        throw PurchaseOrderErrors.vendorNotOrderable();
      }

      const sequence = await this.purchaseOrderRepository.nextOrderSequence();
      const orderNumber = OrderNumber.generate(sequence);

      const existing = await this.purchaseOrderRepository.findByOrderNumber(orderNumber.value);
      if (existing) {
        throw PurchaseOrderErrors.orderNumberConflict(orderNumber.value);
      }

      const purchaseOrder = PurchaseOrder.create({
        orderNumber: orderNumber.value,
        vendorId: input.vendorId,
        currency: input.currency ?? 'USD',
      });

      await this.purchaseOrderRepository.save(purchaseOrder);

      for (const event of purchaseOrder.pullEvents()) {
        await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
        this.eventBus.publish(event);
      }

      return purchaseOrder.id;
    });
  }
}
