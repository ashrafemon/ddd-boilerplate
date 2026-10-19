import { ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { PurchaseOrder } from '../../domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CreatePurchaseOrderUseCase } from './create-purchase-order.usecase';

export interface ImportPurchaseOrderRequest {
  externalReference: string;
  vendorId: string;
  currency?: string;
  lines: { productId: string; quantity: number; unitPrice: number }[];
}

/**
 * Find-or-create a DRAFT purchase order by its external reference and set its lines,
 * in ONE transaction. Built for at-least-once import delivery: re-running the same
 * request converges on the same PO and the same lines (no duplicate PO, no summed
 * quantities). Line products are resolved and checked purchasable by the caller
 * (the import handler, which re-validates right before executing each chunk).
 */
@Injectable()
export class ImportPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly createPurchaseOrder: CreatePurchaseOrderUseCase,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
  ) {}

  @Transactional()
  async execute(input: ImportPurchaseOrderRequest): Promise<PurchaseOrderId> {
    const purchaseOrder = await this.findOrCreate(input);

    let changed = false;
    for (const line of input.lines) {
      const lineChanged = purchaseOrder.setLine(
        line.productId,
        line.quantity,
        Money.fromDecimal(line.unitPrice, purchaseOrder.currency),
      );
      changed = changed || lineChanged;
    }

    if (changed) {
      await this.purchaseOrderRepository.update(purchaseOrder);
    }
    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }
    return purchaseOrder.id;
  }

  private async findOrCreate(input: ImportPurchaseOrderRequest): Promise<PurchaseOrder> {
    const existing = await this.purchaseOrderRepository.findByExternalReference(
      input.externalReference,
    );
    if (existing) {
      if (existing.vendorId !== input.vendorId) {
        throw new ConflictException(
          `Purchase order '${input.externalReference}' already exists for a different vendor`,
        );
      }
      if (input.currency && existing.currency !== input.currency) {
        throw new ConflictException(
          `Purchase order '${input.externalReference}' already exists in ${existing.currency}, not ${input.currency}`,
        );
      }
      return existing;
    }

    const id = await this.createPurchaseOrder.execute({
      vendorId: input.vendorId,
      currency: input.currency,
      externalReference: input.externalReference,
    });
    const created = await this.purchaseOrderRepository.findById(id);
    if (!created) {
      throw new ConflictException(
        `Purchase order '${input.externalReference}' vanished after create`,
      );
    }
    return created;
  }
}
