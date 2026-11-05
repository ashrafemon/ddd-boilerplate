import { ConflictException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { PurchaseOrder } from '../../domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPricingService } from '../../domain/services/purchase-order-pricing.service';
import { PurchaseOrderPublisherPort } from '../integrations/publishes/purchase-order.publisher-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { ReadCachePort } from '../outbound-ports/read-cache.port';
import { ImportPurchaseOrderRequest } from '../../domain/types/purchase-order.types';

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
    private readonly companyConfig: CompanyConfigPort,
    private readonly vendorQueryPort: OrderableVendorPort,
    private readonly numbering: NumberingPort,
    private readonly requestContext: RequestContextPort,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(input: ImportPurchaseOrderRequest): Promise<string> {
    const existing = await this.purchaseOrderRepository.findByExternalReference(
      input.externalReference,
    );
    let purchaseOrder: PurchaseOrder;
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
      purchaseOrder = existing;
    } else {
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
      const actorId = this.requestContext.getUserId();
      purchaseOrder = PurchaseOrderFactory.create({
        orderNumber,
        vendorId: input.vendorId,
        currency,
        externalReference: input.externalReference,
        createdBy: actorId,
      });

      await this.purchaseOrderRepository.save(purchaseOrder);
      for (const event of purchaseOrder.pullEvents()) {
        await this.integrationEvent.send(event, purchaseOrder.id.toString());
      }
    }

    let changed = false;
    for (const line of input.lines) {
      const lineChanged = purchaseOrder.setLine(
        line.productId,
        line.quantity,
        PurchaseOrderPricingService.toMoney(line.unitPrice, purchaseOrder.currency),
      );
      changed = changed || lineChanged;
    }

    if (changed) {
      await this.purchaseOrderRepository.update(purchaseOrder);
    }
    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }
    await this.readCache.invalidate(`purchase-order:${purchaseOrder.id.toString()}`);
    return purchaseOrder.id.toString();
  }
}
