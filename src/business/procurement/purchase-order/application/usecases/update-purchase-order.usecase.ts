import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UpdatePurchaseOrderHeaderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { PurchaseOrderReadCache } from '../outbound-ports/read-cache.port';

/**
 * Update the draft header of a purchase order (plan Phase 2.2 / spec §3.1).
 *
 * DRAFT-only is an aggregate invariant, so batch/import/API origins all hit
 * the same 422. `externalReference` is unique — a collision is surfaced as
 * 409 here instead of letting Postgres P2002 escape as a 500.
 */
@Injectable()
export class UpdatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly readCache: PurchaseOrderReadCache,
  ) {}

  @Transactional()
  async execute(input: UpdatePurchaseOrderHeaderRequest): Promise<PurchaseOrderId> {
    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    if (
      input.externalReference !== undefined &&
      input.externalReference !== purchaseOrder.externalReference
    ) {
      const existing = await this.purchaseOrderRepository.findByExternalReference(
        input.externalReference,
      );
      if (existing) {
        throw new ConflictException('externalReference is already used by another purchase order');
      }
    }

    purchaseOrder.updateHeader({
      orderDate: input.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      externalReference: input.externalReference,
    });

    await this.purchaseOrderRepository.update(purchaseOrder);
    await this.readCache.invalidate(purchaseOrder.id.toString());

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id;
  }
}
