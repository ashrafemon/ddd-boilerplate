import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { CreatePurchaseOrderRequest } from '../../domain/types/purchase-order.types';
import { PurchaseOrderFactory } from '../../domain/factories/purchase-order.factory';
import { PurchaseOrderId } from '../../domain/value-objects/purchase-order-id.vo';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { PurchaseOrderCommandRepository } from '../../domain/repositories/purchase-order-command.repository';
import { PurchaseOrderIntegrationPort } from '../integrations/publishes/purchase-order.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';
import { IdempotencyPort } from '@platform/idempotency/ports/idempotency.port';
import { NumberingPort } from '../outbound-ports/numbering.port';

@Injectable()
export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderCommandRepository,
    private readonly vendorQueryPort: OrderableVendorPort,
    private readonly integrationEvent: PurchaseOrderIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
    private readonly numbering: NumberingPort,
    private readonly requestContext: RequestContextPort,
    private readonly idempotency: IdempotencyPort,
  ) {}

  @Transactional()
  async execute(input: CreatePurchaseOrderRequest): Promise<PurchaseOrderId> {
    const tenantId = this.requestContext.getTenantId() ?? '';
    const companyId = this.requestContext.getCompanyId() ?? '';
    const actorId = input.actorId ?? this.requestContext.getUserId();

    const reserveResult = input.idempotencyKey
      ? await this.idempotency.reserve({
          tenantId,
          companyId,
          scope: 'purchase-order.create',
          key: input.idempotencyKey,
        })
      : null;

    if (reserveResult) {
      if (reserveResult.status === 'REPLAY') {
        return PurchaseOrderId.fromString(reserveResult.result as string);
      }
      if (reserveResult.status === 'BUSY') {
        throw new ConflictException('Purchase order create is already in progress');
      }
      if (reserveResult.status === 'KEY_MISMATCH') {
        throw new ConflictException('Idempotency key mismatch');
      }
    }

    const reservation = reserveResult?.reservation;

    try {
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

      if (reservation) {
        await this.idempotency.complete({ reservation, result: purchaseOrder.id.toString() });
      }

      return purchaseOrder.id;
    } catch (error) {
      if (reservation) {
        await this.idempotency.fail({ reservation });
      }
      throw error;
    }
  }
}
