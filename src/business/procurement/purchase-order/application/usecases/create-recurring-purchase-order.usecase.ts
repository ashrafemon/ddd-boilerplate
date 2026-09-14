import { JsonObject, JsonValue } from '@shared-kernel/types/json-value.type';
import { ConflictException, Injectable } from '@nestjs/common';
import { RecurringTemplatePort } from '@platform/recurring/ports/recurring-template.port';
import type {
  CreateRecurringTemplateInput,
  RecurringTemplateRecord,
} from '@platform/recurring/recurring-template.types';
import { OrderableVendorPort } from '../outbound-ports/vendor-query.port';
import { NumberingPort } from '../outbound-ports/numbering.port';

const TEMPLATE_SEQUENCE = 'RecurringTemplate:PurchaseOrder';

export interface CreateRecurringPurchaseOrderLineInput {
  [key: string]: JsonValue;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateRecurringPurchaseOrderInput {
  tenantId?: string;
  name: string;
  vendorId: string;
  currency?: string;
  lines: CreateRecurringPurchaseOrderLineInput[];
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
  generationCondition?: JsonObject;
  createdBy?: string;
}

/**
 * Scenario "new data": create a Recurring template for PurchaseOrder from a
 * vendor + line set the caller provides directly — no existing PurchaseOrder
 * required. Generation happens later via GenerateRecurringPurchaseOrderUseCase
 * when the schedule/event fires.
 */
@Injectable()
export class CreateRecurringPurchaseOrderUseCase {
  constructor(
    private readonly vendorQueryPort: OrderableVendorPort,
    private readonly numbering: NumberingPort,
    private readonly createRecurringTemplate: RecurringTemplatePort,
  ) {}

  async execute(input: CreateRecurringPurchaseOrderInput): Promise<RecurringTemplateRecord> {
    if (!input.lines.length) {
      throw new ConflictException('Recurring PurchaseOrder template must have at least one line');
    }

    const vendor = await this.vendorQueryPort.getOrderableVendor(input.vendorId);
    if (!vendor) {
      throw new ConflictException('Vendor is not orderable (blocked or inactive)');
    }

    const templateNo = await this.numbering.nextNumber(TEMPLATE_SEQUENCE, { prefix: 'REC-PO-' });

    return this.createRecurringTemplate.create({
      tenantId: input.tenantId,
      templateNo,
      name: input.name,
      targetEntityType: 'PurchaseOrder',
      partyId: input.vendorId,
      partyType: 'VENDOR',
      currency: input.currency ?? 'USD',
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
      lines: input.lines,
      createdBy: input.createdBy,
    });
  }
}
