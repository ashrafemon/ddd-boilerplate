import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { UpdatePurchaseOrderLineRequest } from '../../domain/types/purchase-order.types';
import { PurchasableProductPort } from '../outbound-ports/product-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPricingService } from '../../domain/services/purchase-order-pricing.service';
import { PurchaseOrderPublisherPort } from '../../integrations/publishes/publishers/purchase-order.publisher-port';

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
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: UpdatePurchaseOrderLineRequest): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'PurchaseOrder',
      action: 'update',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const product = await this.productQueryPort.getPurchasableProduct(input.productId);
    if (!product) {
      throw new ConflictException('Product is not purchasable');
    }

    const id = input.id;
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    const changed = purchaseOrder.setLine(
      input.productId,
      input.quantity,
      PurchaseOrderPricingService.toMoney(
        input.unitPrice,
        input.currency ?? ctx.defaultCurrency ?? 'USD',
      ),
      product.name,
    );
    if (!changed) {
      return purchaseOrder.id.toString();
    }

    await this.purchaseOrderRepository.update(purchaseOrder);

    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
