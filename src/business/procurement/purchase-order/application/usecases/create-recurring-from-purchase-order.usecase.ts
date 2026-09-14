import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RecurringTemplatePort } from '@platform/recurring/ports/recurring-template.port';
import type {
  CreateRecurringTemplateInput,
  RecurringTemplateRecord,
} from '@platform/recurring/recurring-template.types';
import { NumberingPort } from '../outbound-ports/numbering.port';
import { GetPurchaseOrderUseCase } from './get-purchase-order.usecase';

const TEMPLATE_SEQUENCE = 'RecurringTemplate:PurchaseOrder';

export interface CreateRecurringFromPurchaseOrderInput {
  tenantId?: string;
  purchaseOrderId: string;
  name?: string;
  triggerType: CreateRecurringTemplateInput['triggerType'];
  eventName?: string;
  frequency?: CreateRecurringTemplateInput['frequency'];
  interval?: number;
  startDate?: Date;
  endDate?: Date;
  timeZone?: string;
  autoPost?: boolean;
  autoEmail?: boolean;
  autoApprove?: boolean;
  generationCondition?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Scenario "from an existing PurchaseOrder": snapshots the vendor, currency,
 * and lines of an already-created purchase order into a new Recurring
 * template, tagging it back to the origin document. Generation happens later
 * via GenerateRecurringPurchaseOrderUseCase when the schedule/event fires.
 */
@Injectable()
export class CreateRecurringFromPurchaseOrderUseCase {
  constructor(
    private readonly getPurchaseOrder: GetPurchaseOrderUseCase,
    private readonly numbering: NumberingPort,
    private readonly createRecurringTemplate: RecurringTemplatePort,
  ) {}

  async execute(input: CreateRecurringFromPurchaseOrderInput): Promise<RecurringTemplateRecord> {
    const purchaseOrder = await this.getPurchaseOrder.execute(input.purchaseOrderId);
    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }
    if (!purchaseOrder.lines.length) {
      throw new ConflictException('Purchase order has no lines to make recurring');
    }

    const templateNo = await this.numbering.nextNumber(TEMPLATE_SEQUENCE, { prefix: 'REC-PO-' });

    return this.createRecurringTemplate.create({
      tenantId: input.tenantId,
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
      createdBy: input.createdBy,
    });
  }
}
