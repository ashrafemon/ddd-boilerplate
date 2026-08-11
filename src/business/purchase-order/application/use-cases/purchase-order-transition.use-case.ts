import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/ports/outbox-writer.port';
import { PurchaseOrderIdInput, RejectInput } from '../../ports/inbound/purchase-order.command.port';
import {
  PURCHASE_ORDER_REPOSITORY,
  PurchaseOrderRepositoryPort,
} from '../../ports/outbound/purchase-order-repository.port';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderErrors } from '../../domain/errors/purchase-order.errors';
import { PurchaseOrderApprovalPolicy } from '../../domain/policies/purchase-order.policy';
import { PurchaseOrderStatus } from '../../domain/entities/purchase-order.aggregate';

type Transition = 'submit' | 'approve' | 'reject' | 'cancel' | 'complete';

@Injectable()
export class PurchaseOrderTransitionUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly purchaseOrderRepository: PurchaseOrderRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(
    input: PurchaseOrderIdInput | RejectInput,
    transition: Transition,
  ): Promise<PurchaseOrderId> {
    return this.unitOfWork.execute(async () => {
      const id = PurchaseOrderId.fromString(input.id);
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      if (!purchaseOrder) {
        throw PurchaseOrderErrors.notFound();
      }

      switch (transition) {
        case 'submit':
          purchaseOrder.submit();
          break;
        case 'approve': {
          if (purchaseOrder.status === PurchaseOrderStatus.SUBMITTED) {
            const policy = PurchaseOrderApprovalPolicy.default();
            const result = policy.evaluate({
              status: purchaseOrder.status,
              totalAmount: purchaseOrder.total.amount,
            });
            if (!result.ok) {
              throw PurchaseOrderErrors.invalidTransition(purchaseOrder.status, 'APPROVED');
            }
          }
          purchaseOrder.approve();
          break;
        }
        case 'reject':
          purchaseOrder.reject((input as RejectInput).reason ?? 'Rejected');
          break;
        case 'cancel':
          purchaseOrder.cancel();
          break;
        case 'complete':
          purchaseOrder.complete();
          break;
      }

      await this.purchaseOrderRepository.update(purchaseOrder);

      for (const event of purchaseOrder.pullEvents()) {
        await this.outboxWriter.append(event, 'PurchaseOrder', purchaseOrder.id.toString());
        this.eventBus.publish(event);
      }

      return purchaseOrder.id;
    });
  }
}
