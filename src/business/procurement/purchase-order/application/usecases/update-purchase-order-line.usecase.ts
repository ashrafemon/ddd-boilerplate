import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { UpdatePurchaseOrderLineRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { PurchasableProductPort } from '../outbound-ports/product-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { ReadCachePort } from '../outbound-ports/read-cache.port';

/**
 * Rewrite one draft line by product id (plan Phase 2.2): `setLine` semantics —
 * quantity/price replace instead of accumulate, so redelivered PATCHes and
 * import rows share the same idempotent write path. The product must still be
 * purchasable and its name is snapshotted onto the line (spec §3.2/§3.3).
 *
 * A no-op PATCH (line already in that state) writes nothing and raises no
 * event — `setLine` returns false and the use case returns early.
 */
@Injectable()
export class UpdatePurchaseOrderLineUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly productQueryPort: PurchasableProductPort,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly readCache: ReadCachePort,
  ) {}

  @Transactional()
  async execute(input: UpdatePurchaseOrderLineRequest): Promise<PurchaseOrderId> {
    const company = await this.companyConfig.getCompanyConfig();
    const currency = input.currency ?? company.defaultCurrency;

    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw new ConflictException('Product is not purchasable');
    }

    const id = PurchaseOrderId.fromString(input.id);
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const changed = purchaseOrder.setLine(
      input.productId,
      input.quantity,
      Money.fromDecimal(input.unitPrice, currency),
      product.name,
    );
    if (!changed) {
      return purchaseOrder.id;
    }

    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    await this.readCache.invalidate(`purchase-order:${purchaseOrder.id.toString()}`);

    return purchaseOrder.id;
  }
}
