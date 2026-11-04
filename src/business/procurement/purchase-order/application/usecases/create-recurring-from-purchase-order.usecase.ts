import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { RecurringTemplatePort } from '@platform/recurring/ports/recurring-template.port';
import type { RecurringTemplateRecord } from '@platform/recurring/recurring-template.types';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { PurchaseOrderQuery } from '../queries/purchase-order.query';
import { CreateRecurringFromPurchaseOrderInput } from '../../domain/types/purchase-order.types';

const TEMPLATE_SEQUENCE = 'RecurringTemplate:PurchaseOrder';

/**
 * Scenario "from an existing PurchaseOrder": snapshots the vendor, currency,
 * and lines of an already-created purchase order into a new Recurring
 * template, tagging it back to the origin document. Generation happens later
 * via GenerateRecurringPurchaseOrderUseCase when the schedule/event fires.
 */
@Injectable()
export class CreateRecurringFromPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrderQuery: PurchaseOrderQuery,
    private readonly numbering: NumberingPort,
    private readonly createRecurringTemplate: RecurringTemplatePort,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: CreateRecurringFromPurchaseOrderInput): Promise<RecurringTemplateRecord> {
    const purchaseOrder = await this.purchaseOrderQuery.findById(input.purchaseOrderId);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }
    if (!purchaseOrder.lines.length) {
      throw new ConflictException('Purchase order has no lines to make recurring');
    }

    const templateNo = await this.numbering.nextNumber(TEMPLATE_SEQUENCE, { prefix: 'REC-PO-' });
    const tenantId = this.requestContext.getTenantId();
    const createdBy = this.requestContext.getUserId();

    return this.createRecurringTemplate.create({
      tenantId,
      templateNo,
      name: input.name ?? `Recurring ${purchaseOrder.orderNumber}`,
      targetEntityType: 'PurchaseOrder',
      originDocumentType: 'PurchaseOrder',
      originDocumentId: purchaseOrder.id,
      partyId: purchaseOrder.vendorId,
      partyType: 'VENDOR',
      currency: purchaseOrder.currency,
      triggerType: input.triggerType,
      eventName: input.eventName,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate,
      timeZone: input.timeZone,
      autoPost: input.autoPost,
      autoEmail: input.autoEmail,
      autoApprove: input.autoApprove,
      generationCondition: input.generationCondition,
      lines: purchaseOrder.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      createdBy,
    });
  }
}
