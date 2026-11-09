import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderPublisherPort } from '../../integrations/publishes/publishers/purchase-order.publisher-port';
import { NumberingPort } from '../outbound-ports/numbering.port';

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly vendorQueryPort: OrderableVendorPort,
    private readonly integrationEvent: PurchaseOrderPublisherPort,
    private readonly numbering: NumberingPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreatePurchaseOrderRequest): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new Error('Company not found in request context');
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
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const currency = input.currency ?? ctx.defaultCurrency ?? 'USD';

    const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
    if (!vendor) {
      throw new ConflictException('Vendor is not orderable (blocked or inactive)');
    }

    const orderNumber = await this.numbering.nextNumber('purchase-order.number', {
      prefix: 'PO-',
      padding: 8,
    });
    const actorId = input.actorId ?? this.requestContext.getUserId();
    const purchaseOrder = PurchaseOrderFactory.create({
      orderNumber,
      vendorId: input.vendorId,
      currency,
      externalReference: input.externalReference,
      orderDate: input.orderDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      createdBy: actorId,
    });

    await this.purchaseOrderRepository.save(purchaseOrder);
    for (const event of purchaseOrder.pullEvents()) {
      await this.integrationEvent.send(event, purchaseOrder.id.toString());
    }

    return purchaseOrder.id.toString();
  }
}
